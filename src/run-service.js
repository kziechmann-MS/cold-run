import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { LlmClient } from "./llm.js";
import { resolvePersona } from "./personas.js";
import { validateTargetUrl } from "./target-validation.js";
import { runBrowserAgent } from "./browser-agent.js";
import { generateFeedback } from "./feedback.js";

export function createRunService({
  runsDirectory = path.resolve("runs"),
  createLlm = () => new LlmClient(),
  runAgent = runBrowserAgent,
  feedback = generateFeedback,
} = {}) {
  return async function run(request) {
    const url = await validateTargetUrl(request?.url);
    const persona = resolvePersona(request?.personaId, request?.customPersona);
    const maxSteps = Math.min(Math.max(Number(request?.maxSteps) || 6, 2), 12);
    const id = randomUUID();
    const outputDirectory = path.join(runsDirectory, id);
    await mkdir(outputDirectory, { recursive: true });

    const startedAt = new Date().toISOString();
    let evidence = [];
    let consoleIssues = [];
    let video = null;
    const errors = [];
    let analysis = fallbackAnalysis();
    try {
      const llm = createLlm();
      const runResult = await runAgent({ url, persona, llm, outputDirectory, maxSteps });
      evidence = runResult.evidence || [];
      consoleIssues = runResult.consoleIssues || [];
      video = runResult.video;
      errors.push(...(runResult.errors || []));
      if (evidence.length) {
        try {
          analysis = await feedback({ llm, persona, url, evidence, consoleIssues });
        } catch (error) {
          errors.push(message(error));
        }
      }
    } catch (error) {
      errors.push(message(error));
    }
    const status = errors.length ? (evidence.length ? "partial" : "failed") : "complete";
    const report = {
      id,
      status,
      url,
      persona,
      startedAt,
      completedAt: new Date().toISOString(),
      evidence: evidence.map((entry) => ({ ...entry, screenshot: `/runs/${id}/${entry.screenshot}` })),
      consoleIssues,
      errors,
      video: video ? `/runs/${id}/${video}` : null,
      artifacts: {
        json: `/runs/${id}/report.json`,
        markdown: `/runs/${id}/report.md`,
      },
      analysis,
    };
    await writeFile(path.join(outputDirectory, "report.json"), JSON.stringify(report, null, 2));
    await writeFile(path.join(outputDirectory, "report.md"), renderMarkdown(report));
    return report;
  };
}

export function renderMarkdown(report) {
  const findings = report.analysis.findings.length
    ? report.analysis.findings.map((finding) =>
      `### ${finding.title}\n\n**Severity:** ${finding.severity}\n\n${finding.evidence}\n\n**Recommendation:** ${finding.recommendation}`).join("\n\n")
    : "No evidence-backed findings were generated.";
  const evidence = report.evidence.map((entry) =>
    `- Step ${entry.step}: **${entry.action}** — ${entry.observation} ([screenshot](${entry.screenshot}))`).join("\n");
  return `# Cold Run: ${report.persona.name} on ${new URL(report.url).hostname}

**Status:** ${report.status}

${report.analysis.summary}

## Findings

${findings}

## Journey evidence

${evidence || "No journey evidence was captured."}

${report.video ? `## Recording\n\n[View run video](${report.video})\n` : ""}`;
}

function fallbackAnalysis() {
  return {
    summary: "The run did not complete analysis. Review the preserved evidence and provider error.",
    sentiment: "mixed",
    findings: [],
    strengths: [],
    limitations: ["Analysis was unavailable because the configured model provider failed."],
  };
}

function message(error) {
  return (error?.message || "The run failed.").slice(0, 500);
}
