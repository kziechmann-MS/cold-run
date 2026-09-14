import test from "node:test";
import assert from "node:assert/strict";
import { applyWaitPolicy, normalizeDecision } from "../src/browser-agent.js";
import { derivePageState, enforceEvidenceConsistency, normalizeFeedback } from "../src/feedback.js";

test("limits browser decisions to observed elements", () => {
  assert.equal(normalizeDecision({ action: "click", target: "missing" }, [{ ref: "e1" }]).action, "finish");
  assert.deepEqual(normalizeDecision({
    action: "fill", target: "e1", text: "Demo", reason: "Try signup", observation: "Email field",
  }, [{ ref: "e1" }]), {
    action: "fill", target: "e1", text: "Demo", reason: "Try signup", observation: "Email field",
  });
});

test("does not wait repeatedly when visible content exists", () => {
  const decision = applyWaitPolicy(
    { action: "wait", observation: "Still loading" },
    [{ action: "wait" }],
    { text: "Visible article content", elements: [] },
  );
  assert.equal(decision.action, "scroll");
});

test("normalizes incomplete feedback into a stable report", () => {
  const result = normalizeFeedback({ findings: [{ severity: "urgent", title: "Confusing" }] });
  assert.equal(result.sentiment, "mixed");
  assert.equal(result.findings[0].severity, "medium");
  assert.match(result.findings[0].evidence, /No supporting/);
});

test("removes empty-page claims contradicted by raw DOM evidence", () => {
  const pageState = derivePageState([{
    rawObservation: {
      headings: ["Live: 2026 US Midterm Election Results"],
      visibleTextLength: 900,
      visibleInteractiveElementCount: 4,
    },
  }]);
  const result = enforceEvidenceConsistency(normalizeFeedback({
    summary: "The page was empty and failed to load.",
    sentiment: "negative",
    findings: [{ title: "Content loading failure", evidence: "No content loaded." }],
  }), pageState);
  assert.equal(pageState.meaningfulContentSeen, true);
  assert.equal(result.findings.length, 0);
  assert.doesNotMatch(result.summary, /empty|failed to load/i);
});

test("preserves component-level empty-state findings", () => {
  const result = enforceEvidenceConsistency(normalizeFeedback({
    summary: "The page loaded, but its search needs guidance.",
    findings: [{ title: "Empty-state onboarding", evidence: "The empty search state lacks guidance." }],
  }), { meaningfulContentSeen: true, emptySupported: false });
  assert.equal(result.findings.length, 1);
});
