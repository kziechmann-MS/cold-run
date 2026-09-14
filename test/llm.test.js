import test from "node:test";
import assert from "node:assert/strict";
import { LlmClient, resolveProvider } from "../src/llm.js";

test("builds Azure deployment URLs and omits model from the body", async () => {
  let request;
  const client = new LlmClient({
    environment: {
      AZURE_OPENAI_ENDPOINT: "https://example.openai.azure.com/",
      AZURE_OPENAI_DEPLOYMENT: "ux model",
      AZURE_OPENAI_API_VERSION: "2025-04-01-preview",
    },
    getAzureToken: async () => "entra-token",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response({ choices: [{ message: { content: "{}" } }] });
    },
  });
  await client.complete("system", "user");
  assert.equal(
    request.url,
    "https://example.openai.azure.com/openai/deployments/ux%20model/chat/completions?api-version=2025-04-01-preview",
  );
  assert.equal(typeof request.options.headers.authorization, "string");
  assert.match(request.options.headers.authorization, /entra-token$/);
  assert.equal("model" in JSON.parse(request.options.body), false);
});

test("uses GitHub Models only when explicitly selected", () => {
  assert.deepEqual(resolveProvider({ COLD_RUN_PROVIDER: "github", GITHUB_TOKEN: "token" }), {
    type: "github",
    apiKey: "token",
    model: "openai/gpt-4.1-mini",
    url: "https://models.github.ai/inference/chat/completions",
  });
  assert.throws(() => resolveProvider({ GITHUB_TOKEN: "ambient-token" }), /Configure/);
});

test("requires complete Azure configuration", () => {
  assert.throws(() => resolveProvider({ AZURE_OPENAI_ENDPOINT: "https://example.com" }), /together/);
});

function response(value) {
  return {
    ok: true,
    async json() {
      return value;
    },
  };
}
