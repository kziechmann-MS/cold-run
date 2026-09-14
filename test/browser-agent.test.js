import test from "node:test";
import assert from "node:assert/strict";
import { collectPageObservation } from "../src/browser-agent.js";
import { derivePageState } from "../src/feedback.js";

test("observes visible content inside nested open shadow roots", () => {
  const heading = element("h1", "Track updates to the election");
  const nestedHeading = element("h2", "Balance of power");
  const button = element("button", "Explore key battlegrounds");
  const nestedRoot = root([nestedHeading, button]);
  const nestedCustomElement = element("election-card", "", nestedRoot);
  const outerRoot = root([heading, nestedCustomElement]);
  const customElement = element("election-app", "", outerRoot);
  const documentRoot = {
    title: "Election results",
    body: { innerText: "" },
    querySelectorAll(selector) {
      return selector === "*" ? [customElement] : [];
    },
  };

  const observation = collectPageObservation(
    documentRoot,
    () => ({ display: "block", visibility: "visible" }),
    { href: "https://example.com/elections" },
  );
  assert.match(observation.text, /Track updates to the election/);
  assert.match(observation.text, /Balance of power/);
  assert.deepEqual(observation.headings, ["Track updates to the election", "Balance of power"]);
  assert.equal(observation.elements[0].text, "Explore key battlegrounds");
  assert.equal(
    derivePageState([{
      rawObservation: {
        headings: observation.headings,
        visibleTextLength: observation.text.length,
        visibleInteractiveElementCount: observation.elements.length,
      },
    }]).meaningfulContentSeen,
    true,
  );
});

function root(elements) {
  return {
    children: elements,
    querySelectorAll(selector) {
      if (selector === "*") return elements;
      if (selector === "h1, h2, h3") return elements.filter(({ tagName }) => /^H[1-3]$/.test(tagName));
      if (selector.includes("button")) return elements.filter(({ tagName }) => tagName === "BUTTON");
      return [];
    },
  };
}

function element(tag, innerText, shadowRoot = null) {
  const attributes = new Map();
  return {
    tagName: tag.toUpperCase(),
    innerText,
    value: "",
    placeholder: "",
    shadowRoot,
    getBoundingClientRect: () => ({ width: 100, height: 20 }),
    getAttribute: (name) => attributes.get(name) || null,
    setAttribute: (name, value) => attributes.set(name, value),
  };
}
