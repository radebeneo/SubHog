import assert from "node:assert/strict";
import test from "node:test";

import {
  formatRenewalDueLabel,
  getRenewalDays,
} from "./utils.ts";

test("renewal day counts compare calendar days without clamping", () => {
  const now = "2026-10-02T12:00:00.000Z";
  assert.equal(getRenewalDays("2026-10-03T12:00:00.000Z", now), 1);
  assert.equal(getRenewalDays("2026-10-02T01:00:00.000Z", now), 0);
  assert.equal(getRenewalDays("2026-09-29T12:00:00.000Z", now), -3);
});

test("renewal labels distinguish tomorrow, today, and overdue dates", () => {
  assert.equal(formatRenewalDueLabel(1), "Due Tomorrow");
  assert.equal(formatRenewalDueLabel(0), "Due Today");
  assert.equal(formatRenewalDueLabel(-1), "Overdue by 1 day");
  assert.equal(formatRenewalDueLabel(-4), "Overdue by 4 days");
  assert.equal(formatRenewalDueLabel(8), "8 days left");
});
