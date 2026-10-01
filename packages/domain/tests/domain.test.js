import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateNextRenewalDate,
  getUpcomingRenewals,
  groupRecurringAmounts,
  isNonNegativeMoneyAmount,
  isPositiveMoneyAmount,
} from "../index.js";

test("money amount predicates preserve API and form boundaries", () => {
  assert.equal(isNonNegativeMoneyAmount(0), true);
  assert.equal(isNonNegativeMoneyAmount(1.25), true);
  assert.equal(isNonNegativeMoneyAmount(-1), false);
  assert.equal(isNonNegativeMoneyAmount(Number.NaN), false);
  assert.equal(isPositiveMoneyAmount(0), false);
  assert.equal(isPositiveMoneyAmount(1.25), true);
});

test("recurring amounts stay grouped by currency and billing frequency", () => {
  assert.deepEqual(
    groupRecurringAmounts([
      { price: 10, currency: "USD", billing: "Monthly" },
      { price: 20, currency: "USD", billing: "Monthly" },
      { price: 5, currency: "GBP", billing: "Yearly" },
    ]),
    [
      ["GBP:Yearly", { total: 5, currency: "GBP", billing: "Yearly" }],
      ["USD:Monthly", { total: 30, currency: "USD", billing: "Monthly" }],
    ],
  );
});

test("renewal ordering is stable and keeps nullable dates out", () => {
  const subscriptions = [
    { id: "later", renewalDate: "2026-04-01T00:00:00.000Z" },
    { id: "none", renewalDate: null },
    { id: "first", renewalDate: "2026-02-01T00:00:00.000Z" },
  ];
  assert.deepEqual(
    getUpcomingRenewals(subscriptions, 1).map(({ id }) => id),
    ["first"],
  );
});

test("calendar renewal increments use Day.js month and year behavior", () => {
  assert.equal(
    calculateNextRenewalDate("2026-01-15T12:00:00.000Z", "monthly"),
    "2026-02-15T12:00:00.000Z",
  );
  assert.equal(
    calculateNextRenewalDate("2026-01-15T12:00:00.000Z", "yearly"),
    "2027-01-15T12:00:00.000Z",
  );
});