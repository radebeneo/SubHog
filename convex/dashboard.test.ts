/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUBSCRIPTION_CATEGORIES } from "../constants/subscriptions";
import type { SubscriptionFieldsInput } from "../types/subscription-record";
import { api } from "./_generated/api";
import { getNextRenewalDate, maxSummaryTimestamp } from "./lib/subscriptionCalculations";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const issuer = "https://test.clerk.accounts.dev";
const accountA = { issuer, subject: "a", tokenIdentifier: `${issuer}|a` };
const accountB = { issuer, subject: "b", tokenIdentifier: `${issuer}|b` };
const now = Date.parse("2026-10-23T10:00:00Z");
const fields: SubscriptionFieldsInput = {
  name: "Subscription", amountCents: 12000, billingCycle: "monthly",
  startDate: "2024-01-01", renewalDate: "2024-01-31",
};

function setup() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  return { t, a: t.withIdentity(accountA), b: t.withIdentity(accountB) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

describe("owned dashboard query", () => {
  it("requires identity and rejects owner/timezone injection", async () => {
    const { t, a } = setup();
    await expect(t.query(api.dashboard.summary, { now }))
      .rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
    for (const extra of [{ ownerId: accountB.tokenIdentifier }, { timeZone: "UTC" }]) {
      await expect(a.query(api.dashboard.summary, { now, ...extra })).rejects.toThrow();
    }
  });

  it("returns a complete zero summary for an empty account", async () => {
    const { a } = setup();
    expect(await a.query(api.dashboard.summary, { now })).toEqual({
      currency: "ZAR", timeZone: "Africa/Johannesburg", asOfDate: "2026-10-23",
      activeSubscriptionCount: 0, monthlySpendCents: 0, annualSpendEstimateCents: 0,
      averageMonthlySpendCents: 0, categories: [], nextRenewalDate: null,
      upcomingSubscriptions: [], hasMoreUpcoming: false,
    });
  });

  it("normalizes mixed Monthly/Yearly spending and defaults missing category to Other", async () => {
    const { a } = setup();
    await a.mutation(api.subscriptions.create, { ...fields, category: "Music" });
    await a.mutation(api.subscriptions.create, {
      ...fields, name: "Annual", billingCycle: "yearly", amountCents: 120000,
    });
    const result = await a.query(api.dashboard.summary, { now });
    expect(result).toMatchObject({
      activeSubscriptionCount: 2, monthlySpendCents: 22000,
      annualSpendEstimateCents: 264000, averageMonthlySpendCents: 11000,
      categories: [
        { category: "Music", subscriptionCount: 1, monthlySpendCents: 12000, annualSpendEstimateCents: 144000 },
        { category: "Other", subscriptionCount: 1, monthlySpendCents: 10000, annualSpendEstimateCents: 120000 },
      ],
    });
  });

  it.each([[1, 0], [5, 0], [6, 1], [7, 1], [17, 1], [18, 2], [19, 2], [29, 2]])(
    "rounds %s annual cents half-up only at the final monthly total (%s cents)",
    async (amountCents, monthlySpendCents) => {
      const { a } = setup();
      await a.mutation(api.subscriptions.create, { ...fields, billingCycle: "yearly", amountCents });
      const result = await a.query(api.dashboard.summary, { now });
      expect(result.monthlySpendCents).toBe(monthlySpendCents);
      expect(result.annualSpendEstimateCents).toBe(amountCents);
      expect(result.averageMonthlySpendCents).toBe(monthlySpendCents);
      expect(result.categories[0].monthlySpendCents).toBe(monthlySpendCents);
    },
  );

  it("adds fractional cents before rounding, not rounded records/categories", async () => {
    const { a } = setup();
    for (const category of ["Music", "Cloud"] as const) {
      for (let i = 0; i < 2; i++) {
        await a.mutation(api.subscriptions.create, {
          ...fields, billingCycle: "yearly", amountCents: 5, category,
        });
      }
    }
    const result = await a.query(api.dashboard.summary, { now });
    expect(result.monthlySpendCents).toBe(2);
    expect(result.annualSpendEstimateCents).toBe(20);
    expect(result.averageMonthlySpendCents).toBe(0);
    expect(result.categories.map((item) => [item.category, item.monthlySpendCents])).toEqual([
      ["Cloud", 1], ["Music", 1],
    ]);
    // Annualizing rounded monthly cents would wrongly produce 24 cents.
    expect(result.annualSpendEstimateCents).not.toBe(result.monthlySpendCents * 12);
  });

  it("rounds average from the exact account total, not rounded monthly cents", async () => {
    const { a } = setup();
    for (const amountCents of [5, 6]) {
      await a.mutation(api.subscriptions.create, { ...fields, billingCycle: "yearly", amountCents });
    }
    const result = await a.query(api.dashboard.summary, { now });
    expect(result.monthlySpendCents).toBe(1);
    expect(result.averageMonthlySpendCents).toBe(0); // 11/24 cents, not rounded 1/2
  });

  it("does not add independently rounded category cents to calculate the account total", async () => {
    const { a } = setup();
    for (const category of ["Music", "Cloud"] as const) {
      await a.mutation(api.subscriptions.create, { ...fields, billingCycle: "yearly", amountCents: 6, category });
    }
    const result = await a.query(api.dashboard.summary, { now });
    expect(result.categories.map((item) => item.monthlySpendCents)).toEqual([1, 1]);
    expect(result.monthlySpendCents).toBe(1);
    expect(result.annualSpendEstimateCents).toBe(12);
    expect(result.averageMonthlySpendCents).toBe(1);
  });

  it("orders categories by unrounded spending, with canonical exact ties", async () => {
    const { a } = setup();
    for (const category of [...SUBSCRIPTION_CATEGORIES].reverse()) {
      await a.mutation(api.subscriptions.create, {
        ...fields, billingCycle: "yearly", amountCents: category === "Music" ? 7 : 6, category,
      });
    }
    const result = await a.query(api.dashboard.summary, { now });
    expect(result.categories.map((item) => item.category))
      .toEqual(["Music", ...SUBSCRIPTION_CATEGORIES.filter((category) => category !== "Music")]);
    expect(result.categories.every((item) => item.monthlySpendCents === 1)).toBe(true);
  });

  it("sorts calculated renewals, keeps today, skips unknown anchors and preserves documents", async () => {
    const { a } = setup();
    const later = await a.mutation(api.subscriptions.create, { ...fields, renewalDate: "2026-11-01" });
    const rolled = await a.mutation(api.subscriptions.create, { ...fields, renewalDate: "2024-03-24" });
    const today = await a.mutation(api.subscriptions.create, { ...fields, renewalDate: "2026-10-23" });
    await a.mutation(api.subscriptions.create, { ...fields, renewalDate: undefined });
    const before = await a.query(api.subscriptions.get, { id: rolled });
    const result = await a.query(api.dashboard.summary, { now });
    expect(result.activeSubscriptionCount).toBe(4);
    expect(result.monthlySpendCents).toBe(48000);
    expect(result.nextRenewalDate).toBe("2026-10-23");
    expect(result.upcomingSubscriptions.map((item) => [item.id, item.renewalDate, item.daysLeft])).toEqual([
      [today, "2026-10-23", 0], [rolled, "2026-10-24", 1], [later, "2026-11-01", 9],
    ]);
    expect(await a.query(api.subscriptions.get, { id: rolled })).toEqual(before);
  });

  it("keeps unknown anchors unknown and excludes sensitive metadata", async () => {
    const { a } = setup();
    await a.mutation(api.subscriptions.create, { ...fields, renewalDate: undefined });
    expect(await a.query(api.dashboard.summary, { now })).toMatchObject({
      monthlySpendCents: 12000, nextRenewalDate: null, upcomingSubscriptions: [],
    });
    const id = await a.mutation(api.subscriptions.create, {
      ...fields, plan: "private-plan", paymentMethod: "private-card", reminderEmail: "private@example.com",
    });
    const result = await a.query(api.dashboard.summary, { now });
    expect(result.upcomingSubscriptions[0]).toEqual({
      id, name: fields.name, amountCents: 12000, billingCycle: "monthly", currency: "ZAR",
      icon: { kind: "wallet" }, color: "#d8d4c8", renewalDate: "2026-10-31", daysLeft: 8,
    });
    for (const sensitive of ["ownerId", "private-plan", "private-card", "private@example.com"]) {
      expect(JSON.stringify(result)).not.toContain(sensitive);
    }
  });

  it("isolates totals/categories/renewals by account and issuer", async () => {
    const { t, a, b } = setup();
    await a.mutation(api.subscriptions.create, { ...fields, category: "Music" });
    await b.mutation(api.subscriptions.create, {
      ...fields, category: "Cloud", amountCents: 90000, renewalDate: "2026-10-23",
    });
    const otherIssuer = "https://other.clerk.accounts.dev";
    const outsider = t.withIdentity({
      subject: accountA.subject, issuer: otherIssuer, tokenIdentifier: `${otherIssuer}|${accountA.subject}`,
    });
    expect(await outsider.query(api.dashboard.summary, { now })).toMatchObject({
      activeSubscriptionCount: 0, monthlySpendCents: 0, categories: [], upcomingSubscriptions: [],
    });
    await outsider.mutation(api.subscriptions.create, { ...fields, amountCents: 30000 });
    const resultA = await a.query(api.dashboard.summary, { now });
    expect(resultA.monthlySpendCents).toBe(12000);
    expect(resultA.categories.map((item) => item.category)).toEqual(["Music"]);
    expect(resultA.upcomingSubscriptions).toHaveLength(1);
    expect(resultA.nextRenewalDate).toBe("2026-10-31");
    expect((await b.query(api.dashboard.summary, { now })).monthlySpendCents).toBe(90000);
    expect((await outsider.query(api.dashboard.summary, { now })).monthlySpendCents).toBe(30000);
  });

  it("recalculates after create/edit/optional clearing/delete, including the last record", async () => {
    const { a } = setup();
    const id = await a.mutation(api.subscriptions.create, { ...fields, category: "Music" });
    expect((await a.query(api.dashboard.summary, { now })).monthlySpendCents).toBe(12000);
    await a.mutation(api.subscriptions.update, {
      id, fields: { ...fields, amountCents: 60000, billingCycle: "yearly", category: "Cloud", renewalDate: "2026-10-24" },
    });
    expect(await a.query(api.dashboard.summary, { now })).toMatchObject({
      monthlySpendCents: 5000, annualSpendEstimateCents: 60000, nextRenewalDate: "2026-10-24",
      categories: [{ category: "Cloud", monthlySpendCents: 5000 }],
    });
    await a.mutation(api.subscriptions.update, {
      id, fields: { ...fields, amountCents: 60000, billingCycle: "yearly", renewalDate: "", category: "" },
    });
    expect(await a.query(api.dashboard.summary, { now })).toMatchObject({
      monthlySpendCents: 5000, nextRenewalDate: null, upcomingSubscriptions: [],
      categories: [{ category: "Other", monthlySpendCents: 5000 }],
    });
    await a.mutation(api.subscriptions.remove, { id });
    expect(await a.query(api.dashboard.summary, { now })).toMatchObject({
      activeSubscriptionCount: 0, monthlySpendCents: 0, annualSpendEstimateCents: 0,
      averageMonthlySpendCents: 0, categories: [], nextRenewalDate: null, upcomingSubscriptions: [],
    });
  });

  it("calculates >100-row totals, bounds only output and keeps equal-date creation order after edits", async () => {
    const { a } = setup();
    const ids = [];
    for (let i = 0; i < 105; i++) {
      vi.setSystemTime(now + i);
      ids.push(await a.mutation(api.subscriptions.create, {
        ...fields, name: `Subscription ${i}`, amountCents: 1, renewalDate: "2026-10-24",
      }));
    }
    await a.mutation(api.subscriptions.update, {
      id: ids[0], fields: { ...fields, amountCents: 1, renewalDate: "2026-10-24", name: "Edited oldest" },
    });
    const result = await a.query(api.dashboard.summary, { now });
    expect(result.activeSubscriptionCount).toBe(105);
    expect(result.monthlySpendCents).toBe(105);
    expect(result.annualSpendEstimateCents).toBe(1260);
    expect(result.upcomingSubscriptions.map((item) => item.id)).toEqual(ids.slice(0, 20));
    expect(result.hasMoreUpcoming).toBe(true);
    expect((await a.query(api.dashboard.summary, { now, upcomingLimit: 100 })).upcomingSubscriptions).toHaveLength(100);
    const limited = await a.query(api.dashboard.summary, { now, upcomingLimit: 1 });
    expect(limited.nextRenewalDate).toBe("2026-10-24");
    expect(limited.monthlySpendCents).toBe(105);
    expect(limited.upcomingSubscriptions).toHaveLength(1);
    expect(limited.hasMoreUpcoming).toBe(true);
  });

  it("uses caller time, Johannesburg midnight and calendar countdowns, not the wall clock", async () => {
    const { a } = setup();
    await a.mutation(api.subscriptions.create, { ...fields, renewalDate: "2026-10-24" });
    const before = await a.query(api.dashboard.summary, { now: Date.parse("2026-10-23T21:59:59.999Z") });
    const midnight = await a.query(api.dashboard.summary, { now: Date.parse("2026-10-23T22:00:00Z") });
    const late = await a.query(api.dashboard.summary, { now: Date.parse("2026-10-24T21:59:59Z") });
    expect(before.asOfDate).toBe("2026-10-23");
    expect(before.upcomingSubscriptions[0].daysLeft).toBe(1);
    expect(midnight.asOfDate).toBe("2026-10-24");
    expect(midnight.upcomingSubscriptions[0].daysLeft).toBe(0);
    expect(late.nextRenewalDate).toBe("2026-10-24");
    expect(late.upcomingSubscriptions[0].daysLeft).toBe(0);
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    expect(await a.query(api.dashboard.summary, { now: Date.parse("2026-10-23T22:00:00Z") })).toEqual(midnight);
  });

  it.each([
    ["2024-02-28T22:00:00Z", "2024-02-29", 0],
    ["2024-02-29T22:00:00Z", "2024-03-31", 30],
    ["2026-12-31T22:00:00Z", "2027-01-31", 30],
  ])("calculates month/year boundary countdowns at %s", async (instant, renewalDate, daysLeft) => {
    const { a } = setup();
    await a.mutation(api.subscriptions.create, fields);
    expect((await a.query(api.dashboard.summary, { now: Date.parse(instant) })).upcomingSubscriptions[0])
      .toMatchObject({ renewalDate, daysLeft });
  });

  it.each([-1, 0.5, NaN, Infinity, -Infinity, maxSummaryTimestamp + 1])(
    "rejects invalid timestamp %s", async (invalidNow) => {
      const { a } = setup();
      await expect(a.query(api.dashboard.summary, { now: invalidNow }))
        .rejects.toMatchObject({ data: { code: "INVALID_INPUT", field: "now" } });
    },
  );

  it.each([0, -1, 101, 1.5, NaN, Infinity])("rejects upcoming limit %s", async (upcomingLimit) => {
    const { a } = setup();
    await expect(a.query(api.dashboard.summary, { now, upcomingLimit }))
      .rejects.toMatchObject({ data: { code: "INVALID_INPUT", field: "upcomingLimit" } });
  });

  it("accepts the supported timestamp boundaries without five-digit calendar dates", async () => {
    const { a } = setup();
    expect((await a.query(api.dashboard.summary, { now: 0 })).asOfDate).toBe("1970-01-01");
    expect((await a.query(api.dashboard.summary, { now: maxSummaryTimestamp })).asOfDate).toBe("9999-12-31");
  });

  it("handles malformed legacy anchors as unknown without changing stored data", async () => {
    const { t, a } = setup();
    const id = await a.mutation(api.subscriptions.create, fields);
    await t.run(async (ctx) => { await ctx.db.patch("subscriptions", id, { renewalDate: "2026-02-30" }); });
    expect(await a.query(api.dashboard.summary, { now })).toMatchObject({
      monthlySpendCents: 12000, nextRenewalDate: null, upcomingSubscriptions: [],
    });
    expect((await a.query(api.subscriptions.get, { id })).renewalDate).toBe("2026-02-30");
  });

  it("supports the scan boundary with safe integers, ignores foreign rows and errors on overflow", async () => {
    const { t, a, b } = setup();
    await t.run(async (ctx) => {
      for (let i = 0; i < 1000; i++) {
        await ctx.db.insert("subscriptions", {
          ...fields, category: undefined, amountCents: 9_999_999, ownerId: accountA.tokenIdentifier,
          currency: "ZAR", status: "active", icon: { kind: "wallet" }, color: "#d8d4c8",
        });
      }
    });
    await b.mutation(api.subscriptions.create, fields);
    const result = await a.query(api.dashboard.summary, { now });
    expect(result.monthlySpendCents).toBe(9_999_999_000);
    expect(result.annualSpendEstimateCents).toBe(119_999_988_000);
    expect(Number.isSafeInteger(result.annualSpendEstimateCents)).toBe(true);
    const overflow = await a.mutation(api.subscriptions.create, fields);
    await expect(a.query(api.dashboard.summary, { now }))
      .rejects.toMatchObject({ data: { code: "SUMMARY_LIMIT_EXCEEDED" } });
    expect((await a.query(api.subscriptions.list, { paginationOpts: { numItems: 100, cursor: null } })).page).toHaveLength(100);
    expect((await b.query(api.dashboard.summary, { now })).activeSubscriptionCount).toBe(1);
    await a.mutation(api.subscriptions.remove, { id: overflow });
    expect((await a.query(api.dashboard.summary, { now })).activeSubscriptionCount).toBe(1000);
  });
});

describe("immutable monthly/yearly renewal anchors", () => {
  it.each([
    ["2026-01-31", "monthly", "2026-02-01", "2026-02-28"],
    ["2026-01-31", "monthly", "2026-02-28", "2026-02-28"],
    ["2026-01-31", "monthly", "2026-03-01", "2026-03-31"],
    ["2026-01-30", "monthly", "2026-03-01", "2026-03-30"],
    ["2026-04-30", "monthly", "2026-05-01", "2026-05-30"],
    ["2026-12-31", "monthly", "2027-01-01", "2027-01-31"],
    ["2024-01-31", "monthly", "2024-02-01", "2024-02-29"],
    ["2024-02-29", "yearly", "2025-02-01", "2025-02-28"],
    ["2024-02-29", "yearly", "2025-03-01", "2026-02-28"],
    ["2024-02-29", "yearly", "2028-02-01", "2028-02-29"],
    ["2000-02-29", "yearly", "2100-02-01", "2100-02-28"],
    ["2000-02-29", "yearly", "2400-02-01", "2400-02-29"],
    ["0004-02-29", "yearly", "2028-03-01", "2029-02-28"],
    ["2026-11-02", "monthly", "2026-10-23", "2026-11-02"],
    ["2028-02-29", "yearly", "2026-10-23", "2028-02-29"],
    ["2024-10-23", "yearly", "2026-10-23", "2026-10-23"],
    ["2026-10-23", "monthly", "2026-10-23", "2026-10-23"],
    ["9999-01-01", "yearly", "9999-12-31", null],
    ["9999-01-30", "monthly", "9999-12-31", null],
  ] as const)("rolls %s %s on %s to %s", (anchor, cycle, today, expected) => {
    expect(getNextRenewalDate(anchor, cycle, today)).toBe(expected);
  });

  it.each([undefined, "", "invalid", "2026-02-30", "2026-1-31", "2026-01-31T00:00:00Z"])(
    "does not invent a renewal for %s", (anchor) => {
      expect(getNextRenewalDate(anchor, "monthly", "2026-10-23")).toBeNull();
    },
  );
});
