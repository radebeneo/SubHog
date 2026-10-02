import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveProfileName,
  isValidProfileName,
  normalizeProfileNamePart,
} from "./profile-name.ts";

test("derives the server profile name from trimmed nonempty parts", () => {
  assert.equal(deriveProfileName("  Owner ", " Example  "), "Owner Example");
  assert.equal(deriveProfileName("Owner", "   "), "Owner");
  assert.equal(deriveProfileName("   ", "Example"), "Example");
  assert.equal(normalizeProfileNamePart("  Owner  "), "Owner");
});

test("enforces the combined 2 through 20 character profile name", () => {
  assert.equal(isValidProfileName("A", ""), false);
  assert.equal(isValidProfileName("Al", ""), true);
  assert.equal(isValidProfileName("1234567890", "123456789"), true);
  assert.equal(isValidProfileName("1234567890", "1234567890"), false);
  assert.equal(isValidProfileName("   ", "   "), false);
});
