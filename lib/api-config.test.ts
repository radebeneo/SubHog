import assert from "node:assert/strict";
import test from "node:test";

import { resolveApiBaseUrl } from "./api-config.ts";

test("requires an explicit valid public API URL", () => {
  assert.throws(() => resolveApiBaseUrl(undefined), /required/);
  assert.throws(() => resolveApiBaseUrl("not a url"), /valid HTTP/);
  assert.throws(() => resolveApiBaseUrl("file:///tmp/api"), /valid HTTP/);
  assert.throws(
    () => resolveApiBaseUrl("https://user:secret@api.example.test/api/v1"),
    /must not contain credentials/,
  );
  assert.throws(
    () => resolveApiBaseUrl("https://api.example.test/api/v1?token=secret"),
    /must not contain credentials/,
  );
  assert.throws(
    () => resolveApiBaseUrl("https://api.example.test/api/v1#fragment"),
    /must not contain credentials/,
  );
  assert.throws(
    () => resolveApiBaseUrl("https://api.example.test"),
    /\/api\/v1 exactly once/,
  );
  assert.throws(
    () => resolveApiBaseUrl("https://api.example.test/api/v1/api/v1"),
    /\/api\/v1 exactly once/,
  );
  assert.equal(
    resolveApiBaseUrl("https://api.example.test/api/v1/"),
    "https://api.example.test/api/v1",
  );
});
