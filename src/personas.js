export const personas = Object.freeze([
  {
    id: "subject-matter-expert",
    name: "Subject-matter expert",
    description: "An experienced domain specialist evaluating whether a product supports real work.",
    goals: "Validate accuracy, depth, and fit with established domain workflows.",
    traits: ["knowledgeable", "detail-oriented", "pragmatic"],
  },
  {
    id: "cautious-consumer",
    name: "Cautious consumer",
    description: "A privacy-conscious shopper who needs reassurance before taking action.",
    goals: "Understand costs, trust signals, and what will happen before sharing information.",
    traits: ["careful", "privacy-conscious", "low risk tolerance"],
  },
  {
    id: "non-technical-operator",
    name: "Non-technical operator",
    description: "An experienced domain professional who rarely uses unfamiliar software.",
    goals: "Complete the main task without learning technical vocabulary or complex navigation.",
    traits: ["task-oriented", "low technical confidence", "prefers plain language"],
  },
  {
    id: "accessibility-first",
    name: "Accessibility-first user",
    description: "A keyboard-oriented user with low vision who relies on clear labels and structure.",
    goals: "Understand and operate the experience without relying on visual polish or precise pointing.",
    traits: ["keyboard-oriented", "low vision", "detail-conscious"],
  },
]);

export function resolvePersona(id, custom) {
  if (id === "custom") {
    const name = clean(custom?.name, 80);
    const description = clean(custom?.description, 500);
    const goals = clean(custom?.goals, 500);
    if (!name || !description || !goals) {
      throw new Error("A custom persona requires a name, description, and goals.");
    }
    return { id: "custom", name, description, goals, traits: [] };
  }

  const persona = personas.find((candidate) => candidate.id === id);
  if (!persona) throw new Error("Select a valid persona.");
  return persona;
}

function clean(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
