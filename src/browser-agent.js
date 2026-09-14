import { chromium } from "playwright";
import { mkdir, rm } from "node:fs/promises";
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
  const evidence = [];
  const consoleIssues = [];
  const errors = [];
  const videoDirectory = path.join(outputDirectory, ".video");
  let browser;
  let context;
  let page;
  let videoName = null;

  try {
    browser = await launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: "Cold Run UX research agent",
      recordVideo: { dir: videoDirectory, size: { width: 1440, height: 900 } },
    });
    page = await context.newPage();
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

      const entry = {
        step: step + 1,
        timestamp: new Date().toISOString(),
        page: { url: page.url(), title: observation.title },
        screenshot,
        rawObservation: summarizeObservation(observation),
      };
      evidence.push(entry);
      let decision;
      try {
        decision = applyWaitPolicy(
          normalizeDecision(
            await llm.complete(
              `${personaPrompt(persona)}\n\n${DECISION_INSTRUCTIONS}`,
              JSON.stringify({ currentPage: observation, priorEvidence: evidence.slice(-6, -1) }),
            ),
            observation.elements,
          ),
          evidence.slice(0, -1),
          observation,
        );
      } catch (error) {
        entry.action = "finish";
        entry.reason = "The model provider could not choose the next action.";
        entry.observation = "Exploration stopped with the evidence collected so far.";
        entry.result = "failed";
        entry.error = safeError(error);
        errors.push(entry.error);
        break;
      }
      Object.assign(entry, {
        action: decision.action,
        target: decision.target || null,
        reason: decision.reason,
        observation: decision.observation,
      });
      if (decision.action === "finish") break;

      try {
        await performAction(page, decision);
        await page.waitForTimeout(600);
        entry.result = "completed";
      } catch (error) {
        entry.result = "failed";
        entry.error = safeError(error).slice(0, 300);
      }
    }
  } catch (error) {
    errors.push(safeError(error));
  } finally {
    const video = page?.video();
    if (context) await context.close().catch(() => {});
    if (video) {
      try {
        videoName = "run.webm";
        await video.saveAs(path.join(outputDirectory, videoName));
      } catch (error) {
        videoName = null;
        errors.push(safeError(error));
      }
    }
    await rm(videoDirectory, { recursive: true, force: true }).catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
  return { evidence, consoleIssues, errors, video: videoName };
}

export async function observe(page) {
  return page.evaluate(collectPageObservation);
}

export function collectPageObservation(
  documentRoot = document,
  styleFor = getComputedStyle,
  pageLocation = location,
) {
  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
  const roots = [documentRoot];
  const seenRoots = new Set(roots);
  for (const root of roots) {
    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot && !seenRoots.has(element.shadowRoot)) {
        roots.push(element.shadowRoot);
        seenRoots.add(element.shadowRoot);
      }
    }
  }
  const queryAll = (selector) => roots.flatMap((root) => Array.from(root.querySelectorAll(selector)));
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = styleFor(element);
    return rect.width > 0
      && rect.height > 0
      && style.display !== "none"
      && style.visibility !== "hidden";
  };
  const candidates = queryAll(
    "a, button, input, textarea, select, [role='button'], [role='link']",
  ).filter(visible).slice(0, 60);

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
  const textParts = [documentRoot.body?.innerText];
  for (const root of roots.slice(1)) {
    const rootText = Array.from(root.children)
      .filter(visible)
      .map((element) => clean(element.innerText))
      .filter(Boolean)
      .join(" ");
    if (rootText) textParts.push(rootText);
  }
  return {
    title: documentRoot.title,
    url: pageLocation.href,
    headings: queryAll("h1, h2, h3")
      .filter(visible)
      .slice(0, 20)
      .map((element) => clean(element.innerText)),
    text: clean([...new Set(textParts.filter(Boolean))].join(" ")).slice(0, 6000),
    elements,
  };
}

function summarizeObservation(observation) {
  return {
    title: observation.title,
    url: observation.url,
    headings: observation.headings,
    textExcerpt: observation.text,
    visibleTextLength: observation.text.length,
    visibleInteractiveElementCount: observation.elements.length,
  };
}

export function applyWaitPolicy(decision, priorEvidence, observation) {
  if (decision.action !== "wait" || priorEvidence.at(-1)?.action !== "wait") return decision;
  if (observation.text.length || observation.elements.length) {
    return {
      action: "scroll",
      reason: "Visible content exists, so continue exploring instead of waiting again.",
      observation: decision.observation,
    };
  }
  return {
    action: "finish",
    reason: "The page remained empty after waiting; finish with partial findings.",
    observation: decision.observation,
  };
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

function safeError(error) {
  return (error?.message || "The browser run failed.").slice(0, 500);
}
