import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveClerkTokenConfig,
  withClerkTokenTemplate,
} from "../src/config/clerk-token.ts";

test("resolveClerkTokenConfig trims optional template values", () => {
  assert.deepEqual(
    resolveClerkTokenConfig({
      EXPO_PUBLIC_CLERK_TOKEN_TEMPLATE: "  subhog-api  ",
    }),
    { template: "subhog-api" },
  );

  assert.deepEqual(
    resolveClerkTokenConfig({ EXPO_PUBLIC_CLERK_TOKEN_TEMPLATE: "   " }),
    { template: undefined },
  );
});

test("withClerkTokenTemplate preserves request options and injects template", () => {
  assert.deepEqual(
    withClerkTokenTemplate(
      { skipCache: true },
      { template: "subhog-api" },
    ),
    { skipCache: true, template: "subhog-api" },
  );

  assert.equal(
    withClerkTokenTemplate(undefined, { template: undefined }),
    undefined,
  );
});
