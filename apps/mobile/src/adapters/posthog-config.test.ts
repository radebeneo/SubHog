import assert from "node:assert/strict";
import test from "node:test";

import {
    isPostHogConfigured,
    resolvePostHogConfig,
    sanitizePostHogProperties,
    warnMissingOptionalAnalytics,
} from "./posthog-config.ts";

test("resolvePostHogConfig keeps optional analytics values when present", () => {
  const config = resolvePostHogConfig({
    EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_test",
    EXPO_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
  });

  assert.deepEqual(config, {
    projectToken: "phc_test",
    host: "https://us.i.posthog.com",
  });

  assert.equal(isPostHogConfigured(config), true);
});

test("resolvePostHogConfig treats missing analytics values as disabled", () => {
  const config = resolvePostHogConfig({
    EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN: "   ",
    EXPO_PUBLIC_POSTHOG_HOST: "",
  });

  assert.deepEqual(config, {
    projectToken: undefined,
    host: undefined,
  });

  assert.equal(isPostHogConfigured(config), false);
});

test("sanitizePostHogProperties strips empty optional payload values", () => {
  assert.deepEqual(
    sanitizePostHogProperties({
      required: "value",
      optional: undefined,
      empty: "",
      missing: null,
      nested: { ok: true },
    }),
    {
      required: "value",
      nested: { ok: true },
    },
  );
});

test("warnMissingOptionalAnalytics emits a concise dev-only warning", () => {
  const originalWarn = console.warn;
  const warnings: string[] = [];

  console.warn = (message?: unknown) => {
    warnings.push(String(message));
  };

  try {
    const config = resolvePostHogConfig({
      EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN: undefined,
      EXPO_PUBLIC_POSTHOG_HOST: undefined,
    });

    warnMissingOptionalAnalytics(config, true);
    assert.equal(warnings.length, 1);
    assert.match(
      warnings[0],
      /Analytics disabled: missing EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN, EXPO_PUBLIC_POSTHOG_HOST/,
    );
  } finally {
    console.warn = originalWarn;
  }
});
