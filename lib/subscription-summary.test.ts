import assert from "node:assert/strict";
import test from "node:test";
import dayjs from "dayjs";
import {
  formatRenewalCountdown,
  getNextRenewalDate,
  getSubscriptionSummary,
} from "./subscription-summary.ts";

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "monthly",
    name: "Monthly subscription",
    icon: 1,
    price: 120,
    currency: "ZAR",
    billing: "Monthly",
    status: "active",
    renewalDate: "2026-10-24T09:00:00",
    ...overrides,
  };
}

test("empty list has zero spend, no next date and no upcoming cards", () => {
  assert.deepEqual(getSubscriptionSummary([], "2026-10-23"), {
    monthlySpend: 0,
    nextRenewalDate: null,
    upcomingSubscriptions: [],
  });
});

test("normalizes yearly prices and excludes inactive subscriptions", () => {
  const summary = getSubscriptionSummary([
    subscription(),
    subscription({ id: "yearly", billing: "Yearly", price: 1200 }),
    subscription({ id: "paused", status: "paused", price: 999 }),
    subscription({ id: "cancelled", status: "cancelled", price: 999 }),
  ], "2026-10-23");
  assert.equal(summary.monthlySpend, 220);
  assert.deepEqual(summary.upcomingSubscriptions.map((item) => item.id), [
    "monthly", "yearly",
  ]);
  assert.equal(summary.upcomingSubscriptions[1].price, 1200);
});

test("sorts upcoming renewals and keeps source records unchanged", () => {
  const records = [
    subscription({ id: "later", renewalDate: "2026-10-29" }),
    subscription({ id: "rolled", renewalDate: "2026-03-24" }),
    subscription({ id: "today", renewalDate: "2026-10-23T01:00:00" }),
  ];
  const original = structuredClone(records);
  const summary = getSubscriptionSummary(records, "2026-10-23T23:30:00");
  assert.deepEqual(summary.upcomingSubscriptions.map((item) => item.id), [
    "today", "rolled", "later",
  ]);
  assert.deepEqual(summary.upcomingSubscriptions.map((item) => item.daysLeft), [
    0, 1, 6,
  ]);
  assert.equal(dayjs(summary.nextRenewalDate).format("YYYY-MM-DD"), "2026-10-23");
  assert.deepEqual(records, original);
});

test("missing or invalid renewal dates do not become upcoming cards", () => {
  const summary = getSubscriptionSummary([
    subscription({ renewalDate: null }),
    subscription({ renewalDate: undefined }),
    subscription({ renewalDate: "invalid" }),
    subscription({ renewalDate: "" }),
  ], "2026-10-23");
  assert.equal(summary.monthlySpend, 480);
  assert.equal(summary.nextRenewalDate, null);
  assert.deepEqual(summary.upcomingSubscriptions, []);
});

test("monthly recurrence clamps month ends without losing the original day", () => {
  const record = subscription({ renewalDate: "2026-01-31T09:00:00" });
  assert.equal(dayjs(getNextRenewalDate(record, "2026-02-01")).format("YYYY-MM-DD"), "2026-02-28");
  assert.equal(dayjs(getNextRenewalDate(record, "2026-03-01")).format("YYYY-MM-DD"), "2026-03-31");
  assert.equal(dayjs(getNextRenewalDate(record, "2030-12-01")).format("YYYY-MM-DD"), "2030-12-31");
});

test("yearly recurrence restores leap day when possible", () => {
  const record = subscription({ billing: "Yearly", renewalDate: "2024-02-29T09:00:00" });
  assert.equal(dayjs(getNextRenewalDate(record, "2025-02-01")).format("YYYY-MM-DD"), "2025-02-28");
  assert.equal(dayjs(getNextRenewalDate(record, "2028-02-01")).format("YYYY-MM-DD"), "2028-02-29");
  assert.equal(dayjs(getNextRenewalDate(record, "2028-03-01")).format("YYYY-MM-DD"), "2029-02-28");
});

test("countdowns use calendar days across midnight and daylight saving", () => {
  const record = subscription({ renewalDate: "2026-03-09T09:00:00" });
  const summary = getSubscriptionSummary([record], "2026-03-07T23:59:00");
  assert.equal(summary.upcomingSubscriptions[0].daysLeft, 2);
  assert.equal(getSubscriptionSummary([record], "2026-03-08T00:01:00").upcomingSubscriptions[0].daysLeft, 1);
  assert.equal(formatRenewalCountdown(0), "Due Today");
  assert.equal(formatRenewalCountdown(1), "Due Tomorrow");
  assert.equal(formatRenewalCountdown(2), "2 days left");
});

test("adding a subscription updates totals, order and nearest renewal", () => {
  const existing = subscription({ renewalDate: "2026-11-23" });
  const added = subscription({ id: "new", price: 60, renewalDate: "2026-10-24" });
  const before = getSubscriptionSummary([existing], "2026-10-23");
  const after = getSubscriptionSummary([added, existing], "2026-10-23");
  assert.equal(after.monthlySpend - before.monthlySpend, 60);
  assert.equal(after.upcomingSubscriptions[0].id, "new");
  assert.equal(dayjs(after.nextRenewalDate).format("YYYY-MM-DD"), "2026-10-24");
});
