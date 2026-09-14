import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { personaPrompt } from "./llm.js";
import { validateTargetUrl } from "./target-validation.js";

const DECISION_INSTRUCTIONS = `Choose exactly one next action based on the page observation and prior evidence.
Return JSON: {"action":"click|fill|scroll|wait|finish","target":"e1","text":"","reason":"short persona-based reason","observation":"what the persona notices"}.
Use only element references present in the observation. Use fill only with clearly fake, non-sensitive data. Finish once you understand the main journey, become blocked, or have enough evidence.`;

export async function runBrowserAgent({
  url,
  persona,
  llm,
  outputDirectory,
  maxSteps = 8,
  launch = (options) => chromium.launch(options),
}) {
  await mkdir(outputDirectory, { recursive: true });
  const browser = await launch({ headless: true });
  const evidence = [];
  const consoleIssues = [];

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: "Cold Run UX research agent",
    });
    const page = await context.newPage();
    await page.route("**/*", async (route) => {
      if (!route.request().isNavigationRequest()) return route.continue();
      try {
        await validateTargetUrl(route.request().url());
        return route.continue();
      } catch {
        return route.abort("blockedbyclient");
      }
    });
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleIssues.push({ type: message.type(), text: message.text().slice(0, 500) });
      }
    });
    page.on("pageerror", (error) => consoleIssues.push({ type: "pageerror", text: error.message.slice(0, 500) }));

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(750);

    for (let step = 0; step < maxSteps; step += 1) {
      const observation = await observe(page);
      const screenshot = `step-${String(step + 1).padStart(2, "0")}.png`;
      await page.screenshot({ path: path.join(outputDirectory, screenshot), fullPage: true });

      const decision = normalizeDecision(
        await llm.complete(
          `${personaPrompt(persona)}\n\n${DECISION_INSTRUCTIONS}`,
          JSON.stringify({ currentPage: observation, priorEvidence: evidence.slice(-5) }),
        ),
        observation.elements,
      );
      const entry = {
        step: step + 1,
        timestamp: new Date().toISOString(),
        page: { url: page.url(), title: observation.title },
        screenshot,
        action: decision.action,
        target: decision.target || null,
        reason: decision.reason,
        observation: decision.observation,
      };
      evidence.push(entry);
      if (decision.action === "finish") break;

      try {
        await performAction(page, decision);
        await page.waitForTimeout(600);
        entry.result = "completed";
      } catch (error) {
        entry.result = "failed";
        entry.error = error.message.slice(0, 300);
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
  return { evidence, consoleIssues };
}

async function observe(page) {
  return page.evaluate(() => {
    const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
    const candidates = Array.from(
      document.querySelectorAll("a, button, input, textarea, select, [role='button'], [role='link']"),
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
    }).slice(0, 60);

    const elements = candidates.map((element, index) => {
      const ref = `e${index + 1}`;
      element.setAttribute("data-cold-run-ref", ref);
      return {
        ref,
        tag: element.tagName.toLowerCase(),
        text: clean(element.innerText || element.value || element.getAttribute("aria-label") || element.placeholder).slice(0, 160),
        type: element.getAttribute("type"),
      };
    });
    return {
      title: document.title,
      url: location.href,
      headings: Array.from(document.querySelectorAll("h1, h2, h3")).slice(0, 20).map((el) => clean(el.innerText)),
      text: clean(document.body?.innerText).slice(0, 6000),
      elements,
    };
  });
}

export function normalizeDecision(value, elements) {
  const allowed = new Set(["click", "fill", "scroll", "wait", "finish"]);
  const action = allowed.has(value?.action) ? value.action : "finish";
  const refs = new Set(elements.map(({ ref }) => ref));
  const needsTarget = action === "click" || action === "fill";
  if (needsTarget && !refs.has(value?.target)) {
    return {
      action: "finish",
      reason: "The requested page element was unavailable.",
      observation: text(value?.observation) || "The journey could not continue safely.",
    };
  }
  return {
    action,
    target: needsTarget ? value.target : undefined,
    text: action === "fill" ? text(value.text).slice(0, 200) : undefined,
    reason: text(value?.reason).slice(0, 300) || "Continue exploring the experience.",
    observation: text(value?.observation).slice(0, 500) || "No observation provided.",
  };
}

async function performAction(page, decision) {
  if (decision.action === "scroll") return page.mouse.wheel(0, 700);
  if (decision.action === "wait") return page.waitForTimeout(1_000);
  const locator = page.locator(`[data-cold-run-ref="${decision.target}"]`).first();
  if (decision.action === "click") return locator.click({ timeout: 8_000 });
  if (decision.action === "fill") return locator.fill(decision.text, { timeout: 8_000 });
}

function text(value) {
  return typeof value === "string" ? value : "";
}
