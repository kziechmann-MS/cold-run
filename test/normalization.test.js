import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDecision } from "../src/browser-agent.js";
import { normalizeFeedback } from "../src/feedback.js";

test("limits browser decisions to observed elements", () => {
  assert.equal(normalizeDecision({ action: "click", target: "missing" }, [{ ref: "e1" }]).action, "finish");
  assert.deepEqual(normalizeDecision({
    action: "fill", target: "e1", text: "Demo", reason: "Try signup", observation: "Email field",
  }, [{ ref: "e1" }]), {
    action: "fill", target: "e1", text: "Demo", reason: "Try signup", observation: "Email field",
  });
});

test("normalizes incomplete feedback into a stable report", () => {
  const result = normalizeFeedback({ findings: [{ severity: "urgent", title: "Confusing" }] });
  assert.equal(result.sentiment, "mixed");
  assert.equal(result.findings[0].severity, "medium");
  assert.match(result.findings[0].evidence, /No supporting/);
});
