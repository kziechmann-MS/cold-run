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

    const llm = createLlm();
    const startedAt = new Date().toISOString();
    const { evidence, consoleIssues } = await runAgent({
      url,
      persona,
      llm,
      outputDirectory,
      maxSteps,
    });
    const analysis = await feedback({ llm, persona, url, evidence, consoleIssues });
    const report = {
      id,
      url,
      persona,
      startedAt,
      completedAt: new Date().toISOString(),
      evidence: evidence.map((entry) => ({ ...entry, screenshot: `/runs/${id}/${entry.screenshot}` })),
      consoleIssues,
      analysis,
    };
    await writeFile(path.join(outputDirectory, "report.json"), JSON.stringify(report, null, 2));
    return report;
  };
}
