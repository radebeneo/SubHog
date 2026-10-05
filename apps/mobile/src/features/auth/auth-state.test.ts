import assert from "node:assert/strict";
import test from "node:test";

import {
  getAuthErrorMessage,
  getMfaStrategyLabel,
  getSessionTaskCopy,
  getSupportedMfaStrategies,
} from "./auth-state.ts";

test("filters MFA factors to strategies implemented by the mobile flow", () => {
  assert.deepEqual(
    getSupportedMfaStrategies([
      { strategy: "email_link" },
      { strategy: "totp" },
      { strategy: "email_code" },
      { strategy: "totp" },
      { strategy: "backup_code" },
    ]),
    ["totp", "email_code", "backup_code"],
  );
  assert.equal(getMfaStrategyLabel("phone_code"), "Text message");
});

test("provides actionable copy for known and future session tasks", () => {
  assert.equal(
    getSessionTaskCopy("reset-password").title,
    "Password update required",
  );
  assert.equal(
    getSessionTaskCopy("future-task").title,
    "Account action required",
  );
});

test("prefers user-safe Clerk messages and falls back for unknown errors", () => {
  assert.equal(
    getAuthErrorMessage({
      longMessage: "Use a stronger password",
      message: "raw",
    }),
    "Use a stronger password",
  );
  assert.equal(getAuthErrorMessage(null, "Try again"), "Try again");
});
