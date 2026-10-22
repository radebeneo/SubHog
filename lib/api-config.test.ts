import assert from "node:assert/strict";
import test from "node:test";

import { resolveApiBaseUrl } from "./api-config.ts";

test("allows an unset or blank URL when no backend is connected", () => {
  assert.equal(resolveApiBaseUrl(undefined), null);
  assert.equal(resolveApiBaseUrl(""), null);
  assert.equal(resolveApiBaseUrl("   "), null);
});

test("validates an explicitly configured public API URL", () => {
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
