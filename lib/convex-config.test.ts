import assert from "node:assert/strict";
import test from "node:test";
import { resolveConvexConfig } from "./convex-config.ts";

test("missing configuration is explicit and distinct from invalid configuration", () => {
  assert.deepEqual(resolveConvexConfig(undefined), { status: "unconfigured" });
  assert.deepEqual(resolveConvexConfig("  "), { status: "unconfigured" });
  assert.equal(resolveConvexConfig("not a URL").status, "invalid");
});

test("hosted deployment URLs normalize without inventing a target", () => {
  assert.deepEqual(resolveConvexConfig(" https://example-123.convex.cloud/ "), {
    status: "configured",
    url: "https://example-123.convex.cloud",
  });
});

test("regional deployment URLs preserve the deployment and region", () => {
  const url = "https://flippant-dolphin-108.eu-west-1.convex.cloud";
  assert.deepEqual(resolveConvexConfig(` ${url}/ `), {
    status: "configured",
    url,
  });
});

test("reject unsafe, non-deployment and credential-bearing URLs without echoing input", () => {
  for (const url of [
    "http://example-123.convex.cloud",
    "https://example-123.convex.site",
    "https://example-123.convex.cloud.attacker.test",
    "https://example-123.convex.cloud/api",
    "https://example-123.convex.cloud?token=secret",
    "https://name:secret@example-123.convex.cloud",
    "https://example-123.convex.cloud#secret",
    "https://example-123.convex.cloud:8080",
    "https://example-123.eu-west-1.convex.cloud.attacker.test",
    "https://example-123.eu-west-1.convex.site",
    "https://example-123..convex.cloud",
    "https://extra.example-123.eu-west-1.convex.cloud",
    "https://name:secret@example-123.eu-west-1.convex.cloud",
    "https://example-123.eu-west-1.convex.cloud?token=secret",
  ]) {
    const result = resolveConvexConfig(url);
    assert.equal(result.status, "invalid");
    assert.ok(!JSON.stringify(result).includes("secret"));
  }
});
