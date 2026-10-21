import assert from "node:assert/strict";
import test from "node:test";

import {
  PASSWORD_MIN_LENGTH,
  getAuthErrorMessage,
  getMfaStrategyLabel,
  getSessionTaskCopy,
  getSupportedMfaStrategies,
  isClerkFormValidationError,
  isValidPassword,
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

test("requires the Clerk password minimum length", () => {
  assert.equal(PASSWORD_MIN_LENGTH, 15);
  assert.equal(isValidPassword("a".repeat(14)), false);
  assert.equal(isValidPassword("a".repeat(15)), true);
});

test("detects Clerk form validation errors and ignores other errors", () => {
  assert.equal(
    isClerkFormValidationError({
      errors: [
        {
          code: "form_password_length_too_short",
          message: "Passwords must be 15 characters or more.",
          meta: { paramName: "password" },
        },
      ],
    }),
    true,
  );
  assert.equal(
    isClerkFormValidationError({
      errors: [
        { code: "form_password_pwned", message: "pwned" },
        { code: "network_error", message: "offline" },
      ],
    }),
    false,
  );
  assert.equal(isClerkFormValidationError({ errors: [] }), false);
  assert.equal(isClerkFormValidationError(new Error("boom")), false);
  assert.equal(isClerkFormValidationError(null), false);
});
