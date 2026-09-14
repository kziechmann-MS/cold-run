import test from "node:test";
import assert from "node:assert/strict";
import { isPrivateAddress, validateTargetUrl } from "../src/target-validation.js";

test("recognizes private and reserved network addresses", () => {
  for (const address of ["127.0.0.1", "10.0.0.2", "172.16.2.3", "192.168.1.5", "::1", "fd00::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  assert.equal(isPrivateAddress("8.8.8.8"), false);
  assert.equal(isPrivateAddress("2606:4700:4700::1111"), false);
});

test("accepts a public HTTP target after DNS validation", async () => {
  const url = await validateTargetUrl("https://example.com/path", async () => [{ address: "93.184.216.34" }]);
  assert.equal(url, "https://example.com/path");
});

test("rejects unsafe protocols, credentials, and private targets", async () => {
  await assert.rejects(() => validateTargetUrl("file:///etc/passwd"), /HTTP or HTTPS/);
  const credentialedUrl = new URL("https://example.com");
  credentialedUrl.username = "user";
  credentialedUrl.password = "pass";
  await assert.rejects(() => validateTargetUrl(credentialedUrl), /credentials/);
  await assert.rejects(
    () => validateTargetUrl("http://internal.test", async () => [{ address: "10.0.0.4" }]),
    /Private, local/,
  );
});
