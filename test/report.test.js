import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRunService, renderMarkdown } from "../src/run-service.js";

test("renders a shareable Markdown report with artifacts", () => {
  const markdown = renderMarkdown({
    url: "https://example.com/path",
    status: "partial",
    persona: { name: "Technical user" },
    video: "/runs/1/run.webm",
    evidence: [{ step: 1, action: "scroll", observation: "Content appeared", screenshot: "/runs/1/step.png" }],
    analysis: {
      summary: "Partial result.",
      findings: [{ title: "Navigation", severity: "medium", evidence: "Step 1", recommendation: "Clarify it." }],
    },
  });
  assert.match(markdown, /Status:\*\* partial/);
  assert.match(markdown, /View run video/);
  assert.match(markdown, /Navigation/);
});

test("preserves partial evidence and writes both report formats", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "cold-run-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const previous = process.env.ALLOW_PRIVATE_TARGETS;
  process.env.ALLOW_PRIVATE_TARGETS = "true";
  context.after(() => {
    if (previous === undefined) delete process.env.ALLOW_PRIVATE_TARGETS;
    else process.env.ALLOW_PRIVATE_TARGETS = previous;
  });
  const run = createRunService({
    runsDirectory: directory,
    createLlm: () => ({}),
    runAgent: async () => ({
      evidence: [{
        step: 1,
        screenshot: "step-01.png",
        action: "finish",
        observation: "Visible content",
        rawObservation: { visibleTextLength: 500, headings: ["A heading"], visibleInteractiveElementCount: 2 },
      }],
      consoleIssues: [],
      errors: ["Provider unavailable."],
      video: "run.webm",
    }),
    feedback: async () => ({
      summary: "Visible content was captured.",
      sentiment: "mixed",
      findings: [],
      strengths: [],
      limitations: [],
    }),
  });
  const report = await run({ url: "https://example.com", personaId: "subject-matter-expert" });
  assert.equal(report.status, "partial");
  assert.equal(report.errors[0], "Provider unavailable.");
  assert.match(await readFile(path.join(directory, report.id, "report.md"), "utf8"), /Visible content/);
  assert.equal(JSON.parse(await readFile(path.join(directory, report.id, "report.json"), "utf8")).status, "partial");
});
