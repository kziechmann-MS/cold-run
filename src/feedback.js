import { personaPrompt } from "./llm.js";

export async function generateFeedback({ llm, persona, url, evidence, consoleIssues }) {
  const result = await llm.complete(
    `${personaPrompt(persona)}
You are now a rigorous UX researcher. Analyze only the supplied evidence. Return JSON with:
{"summary":"2-3 sentences","sentiment":"positive|mixed|negative","findings":[{"severity":"high|medium|low","title":"concise","evidence":"specific step and observation","recommendation":"actionable change"}],"strengths":["specific strength"],"limitations":["coverage caveat"]}.
Prioritize usability friction and product-quality issues. Do not invent facts.`,
    JSON.stringify({ url, evidence, consoleIssues }),
  );
  return normalizeFeedback(result);
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
