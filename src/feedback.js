import { personaPrompt } from "./llm.js";

export async function generateFeedback({ llm, persona, url, evidence, consoleIssues }) {
  const pageState = derivePageState(evidence);
  const result = await llm.complete(
    `${personaPrompt(persona)}
You are now a rigorous UX researcher. Analyze only the supplied evidence. Return JSON with:
{"summary":"2-3 sentences","sentiment":"positive|mixed|negative","findings":[{"severity":"high|medium|low","title":"concise","evidence":"specific step and observation","recommendation":"actionable change"}],"strengths":["specific strength"],"limitations":["coverage caveat"]}.
Prioritize usability friction and product-quality issues. Raw DOM observations are more reliable than the agent's interpretation. Only report an empty page or content-loading failure when pageState.emptySupported is true. Console errors are supporting evidence, not proof that visible content failed. Do not invent facts.`,
    JSON.stringify({ url, pageState, evidence, consoleIssues }),
  );
  return enforceEvidenceConsistency(normalizeFeedback(result), pageState);
}

export function derivePageState(evidence) {
  const observations = evidence.map((entry) => entry.rawObservation).filter(Boolean);
  const meaningfulContentSeen = observations.some((observation) =>
    observation.visibleTextLength >= 200
    || observation.headings?.some((heading) => heading.length >= 10)
    || observation.visibleInteractiveElementCount >= 2);
  const emptySupported = observations.length >= 2 && observations.every((observation) =>
    observation.visibleTextLength < 100
    && !observation.headings?.some(Boolean)
    && observation.visibleInteractiveElementCount === 0);
  return { observations: observations.length, meaningfulContentSeen, emptySupported };
}

export function enforceEvidenceConsistency(feedback, pageState) {
  if (!pageState.meaningfulContentSeen || pageState.emptySupported) return feedback;
  const unsupportedLoadClaim = /\b(?:page|site|content|experience)\s+(?:is|was|remains?|appears?)?\s*(?:completely\s+)?(?:empty|blank)\b|\b(?:page|site|content|experience)\s+(?:failed|did not|was unable) to load\b|\b(?:page|content) loading failure\b|\bno (?:visible |meaningful )?(?:page )?content (?:loaded|appeared|was visible)\b/i;
  const findings = feedback.findings.filter((finding) =>
    !unsupportedLoadClaim.test(`${finding.title} ${finding.evidence}`));
  const summary = unsupportedLoadClaim.test(feedback.summary)
    ? "The page exposed meaningful visible content during the run. Findings below are limited to behavior supported by the recorded DOM evidence."
    : feedback.summary;
  const limitations = findings.length === feedback.findings.length
    ? feedback.limitations
    : [...feedback.limitations, "An unsupported content-loading claim was omitted because recorded DOM evidence showed meaningful content."];
  return { ...feedback, summary, findings, limitations };
}

export function normalizeFeedback(value) {
  const findings = Array.isArray(value?.findings) ? value.findings.slice(0, 10) : [];
  return {
    summary: string(value?.summary, "The run completed without a usable summary.", 1500),
    sentiment: ["positive", "mixed", "negative"].includes(value?.sentiment) ? value.sentiment : "mixed",
    findings: findings.map((finding) => ({
      severity: ["high", "medium", "low"].includes(finding?.severity) ? finding.severity : "medium",
      title: string(finding?.title, "Usability finding", 200),
      evidence: string(finding?.evidence, "No supporting detail was returned.", 1000),
      recommendation: string(finding?.recommendation, "Review this part of the journey.", 1000),
    })),
    strengths: strings(value?.strengths),
    limitations: strings(value?.limitations),
  };
}

function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string").slice(0, 10) : [];
}

function string(value, fallback, max) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}
