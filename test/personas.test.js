import test from "node:test";
import assert from "node:assert/strict";
import { personas, resolvePersona } from "../src/personas.js";

test("resolves a preset persona", () => {
  assert.equal(resolvePersona(personas[0].id).name, personas[0].name);
});

test("normalizes a complete custom persona", () => {
  assert.deepEqual(resolvePersona("custom", {
    name: "  Busy parent ",
    description: " Uses a phone between errands. ",
    goals: " Finish quickly. ",
  }), {
    id: "custom",
    name: "Busy parent",
    description: "Uses a phone between errands.",
    goals: "Finish quickly.",
    traits: [],
  });
});

test("rejects incomplete or unknown personas", () => {
  assert.throws(() => resolvePersona("custom", { name: "Someone" }), /requires/);
  assert.throws(() => resolvePersona("unknown"), /valid persona/);
});
