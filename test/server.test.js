import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

test("serves personas and accepts run requests", async (context) => {
  let received;
  const server = createServer({ runService: async (body) => {
    received = body;
    return { id: "run-1" };
  } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  const personas = await fetch(`${base}/api/personas`).then((response) => response.json());
  assert.ok(personas.length >= 4);

  const response = await fetch(`${base}/api/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: "https://example.com", personaId: personas[0].id }),
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).id, "run-1");
  assert.equal(received.personaId, personas[0].id);

  const missing = await fetch(`${base}/favicon.ico`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, "Not found.");

  const afterMissing = await fetch(`${base}/api/personas`);
  assert.equal(afterMissing.status, 200);
});
