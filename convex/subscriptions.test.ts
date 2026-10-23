/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUBSCRIPTION_CATEGORIES } from "../constants/subscriptions";
import { parseZarAmountCents } from "../lib/subscription-rules";
import type { SubscriptionFieldsInput } from "../types/subscription-record";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const issuer = "https://test.clerk.accounts.dev";
const accountA = { issuer, subject: "account-a", tokenIdentifier: `${issuer}|account-a` };
const accountB = { issuer, subject: "account-b", tokenIdentifier: `${issuer}|account-b` };
const fields: SubscriptionFieldsInput = {
  name: "My subscription",
  amountCents: 9999,
  billingCycle: "monthly",
  startDate: "2024-01-31",
  renewalDate: "2024-02-29",
};
const paginationOpts = { numItems: 10, cursor: null };
const notFound = { code: "NOT_FOUND", message: "Record not found." };

function setup() {
  const t = convexTest({ schema, modules, transactionLimits: true });
  return { t, a: t.withIdentity(accountA), b: t.withIdentity(accountB) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-23T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("subscription ownership and persistence operations", () => {
  it("requires identity on every endpoint without mutating existing data", async () => {
    const { t, a } = setup();
    const id = await a.mutation(api.subscriptions.create, fields);
    const before = await a.query(api.subscriptions.get, { id });
    for (const call of [
      () => t.mutation(api.subscriptions.create, fields),
      () => t.query(api.subscriptions.list, { paginationOpts }),
      () => t.query(api.subscriptions.get, { id }),
      () => t.mutation(api.subscriptions.update, { id, fields }),
      () => t.mutation(api.subscriptions.remove, { id }),
    ]) {
      await expect(call()).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
    }
    expect(await a.query(api.subscriptions.get, { id })).toEqual(before);
    expect((await a.query(api.subscriptions.list, { paginationOpts })).page).toHaveLength(1);
  });

  it("stores canonical fields and serves them to a new session of the same account", async () => {
    const { t, a, b } = setup();
    const id = await a.mutation(api.subscriptions.create, {
      ...fields,
      name: "  My subscription  ",
      plan: "  Pro  ",
      category: " Music ",
      paymentMethod: "  Personal card  ",
      reminderEmail: "  reminder@example.com  ",
      icon: { kind: "iconify", name: "simple-icons:spotify" },
    });
    const newSession = t.withIdentity({ ...accountA, name: "Updated Clerk display name" });
    const saved = await newSession.query(api.subscriptions.get, { id });
    expect(saved).toMatchObject({
      ...fields,
      ownerId: accountA.tokenIdentifier,
      currency: "ZAR",
      status: "active",
      plan: "Pro",
      category: "Music",
      paymentMethod: "Personal card",
      reminderEmail: "reminder@example.com",
      icon: { kind: "iconify", name: "simple-icons:spotify" },
      color: "#f0c4d8",
    });
    expect(saved).not.toHaveProperty("price");
    expect(saved).not.toHaveProperty("frequency");
    expect(saved).not.toHaveProperty("billing");
    expect((await a.query(api.subscriptions.list, { paginationOpts })).page).toEqual([saved]);
    expect((await b.query(api.subscriptions.list, { paginationOpts })).page).toEqual([]);
  });

  it("isolates accounts and issuers for list/get/update/delete", async () => {
    const { t, a, b } = setup();
    const id = await a.mutation(api.subscriptions.create, fields);
    const otherIssuer = "https://other.clerk.accounts.dev";
    const outsider = t.withIdentity({
      subject: accountA.subject,
      issuer: otherIssuer,
      tokenIdentifier: `${otherIssuer}|${accountA.subject}`,
    });
    for (const client of [b, outsider]) {
      expect((await client.query(api.subscriptions.list, { paginationOpts })).page).toEqual([]);
      await expect(client.query(api.subscriptions.get, { id })).rejects.toMatchObject({ data: notFound });
      await expect(client.mutation(api.subscriptions.update, {
        id, fields: { ...fields, name: "Unauthorized change" },
      })).rejects.toMatchObject({ data: notFound });
      await expect(client.mutation(api.subscriptions.remove, { id })).rejects.toMatchObject({ data: notFound });
    }
    expect(await a.query(api.subscriptions.get, { id })).toMatchObject(fields);
  });

  it("makes missing and foreign IDs indistinguishable and never recreates a deleted record", async () => {
    const { a, b } = setup();
    const missing = await a.mutation(api.subscriptions.create, fields);
    const foreign = await b.mutation(api.subscriptions.create, fields);
    expect(await a.mutation(api.subscriptions.remove, { id: missing })).toBeNull();
    for (const id of [missing, foreign]) {
      await expect(a.query(api.subscriptions.get, { id })).rejects.toMatchObject({ data: notFound });
      await expect(a.mutation(api.subscriptions.update, { id, fields })).rejects.toMatchObject({ data: notFound });
      await expect(a.mutation(api.subscriptions.remove, { id })).rejects.toMatchObject({ data: notFound });
    }
    expect((await a.query(api.subscriptions.list, { paginationOpts })).page).toEqual([]);
    expect((await b.query(api.subscriptions.list, { paginationOpts })).page).toHaveLength(1);
  });

  it("updates editable fields, clears optional fields and preserves immutable metadata", async () => {
    const { a } = setup();
    const id = await a.mutation(api.subscriptions.create, {
      ...fields, plan: "Pro", category: "Music",
      paymentMethod: "Personal card", reminderEmail: "reminder@example.com",
      icon: { kind: "iconify", name: "simple-icons:spotify" },
    });
    const before = await a.query(api.subscriptions.get, { id });
    vi.setSystemTime(new Date("2026-10-24T10:00:00Z"));
    expect(await a.mutation(api.subscriptions.update, {
      id,
      fields: {
        name: "  Updated  ", amountCents: 15000, billingCycle: "yearly",
        startDate: "2025-01-01", plan: "", category: "  ", reminderEmail: " ",
      },
    })).toBeNull();
    const after = await a.query(api.subscriptions.get, { id });
    expect(after).toEqual({
      _id: before._id, _creationTime: before._creationTime,
      ownerId: before.ownerId, currency: before.currency, status: before.status,
      icon: before.icon, color: before.color,
      name: "Updated", amountCents: 15000, billingCycle: "yearly", startDate: "2025-01-01",
    });
    await a.mutation(api.subscriptions.update, { id, fields: { ...fields, category: "Cloud" } });
    expect(await a.query(api.subscriptions.get, { id })).toMatchObject({ category: "Cloud", color: before.color });
  });

  it("paginates only the owner's records newest first, including after edits", async () => {
    const { a, b } = setup();
    const ids = [];
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(new Date(Date.UTC(2026, 9, 23, 10, i)));
      ids.push(await a.mutation(api.subscriptions.create, { ...fields, name: `Record ${i}` }));
      await b.mutation(api.subscriptions.create, { ...fields, name: `Foreign ${i}` });
    }
    await a.mutation(api.subscriptions.update, { id: ids[0], fields: { ...fields, name: "Edited oldest" } });
    const first = await a.query(api.subscriptions.list, { paginationOpts: { numItems: 2, cursor: null } });
    const second = await a.query(api.subscriptions.list, {
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
    });
    const last = await a.query(api.subscriptions.list, {
      paginationOpts: { numItems: 2, cursor: second.continueCursor },
    });
    expect(first.isDone).toBe(false);
    expect(second.isDone).toBe(false);
    expect(last.isDone).toBe(true);
    expect([...first.page, ...second.page, ...last.page].map((doc) => doc._id)).toEqual([...ids].reverse());
  });

  it.each([0, -1, 101, 1.5])("rejects invalid page size %s", async (numItems) => {
    const { a } = setup();
    await expect(a.query(api.subscriptions.list, {
      paginationOpts: { numItems, cursor: null },
    })).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
  });

  it("rejects injected owner, state, visuals and legacy contract fields", async () => {
    const { a } = setup();
    for (const extra of [
      { ownerId: accountB.tokenIdentifier }, { currency: "USD" }, { status: "cancelled" },
      { color: "#000000" }, { price: 99.99 }, { frequency: "Monthly" }, { billing: "Yearly" },
    ]) {
      await expect(a.mutation(api.subscriptions.create, { ...fields, ...extra })).rejects.toThrow();
    }
    expect((await a.query(api.subscriptions.list, { paginationOpts })).page).toEqual([]);
    const id = await a.mutation(api.subscriptions.create, fields);
    const before = await a.query(api.subscriptions.get, { id });
    for (const extra of [
      { ownerId: accountB.tokenIdentifier }, { currency: "USD" }, { status: "paused" },
      { color: "#000000" }, { icon: { kind: "wallet" } }, { price: 1 }, { frequency: "Yearly" },
    ]) {
      await expect(a.mutation(api.subscriptions.update, {
        id, fields: { ...fields, ...extra },
      })).rejects.toThrow();
    }
    expect(await a.query(api.subscriptions.get, { id })).toEqual(before);
  });
});

describe("subscription business validation", () => {
  const invalidFields: Partial<SubscriptionFieldsInput>[] = [
    { name: "" }, { name: "   " }, { name: "a".repeat(81) },
    { amountCents: 0 }, { amountCents: -1 }, { amountCents: 0.5 },
    { amountCents: 100.01 }, { amountCents: 10_000_000 },
    { amountCents: Number.NaN }, { amountCents: Infinity }, { amountCents: -Infinity },
    { plan: "a".repeat(81) }, { paymentMethod: "a".repeat(81) },
    { reminderEmail: "a".repeat(255) }, { reminderEmail: "not-an-email" },
    { reminderEmail: "a..b@example.com" }, { reminderEmail: "a@-example.com" },
    { category: "Unapproved category" }, { startDate: "2025-02-29" },
    { startDate: "2024-04-31" }, { startDate: "0000-01-01" }, { startDate: "2024-13-01" },
    { startDate: "2024-00-01" }, { startDate: "2024-01-00" },
    { startDate: "2024-1-31" }, { startDate: "2024-01-31T00:00:00Z" },
    { renewalDate: "2024-01-30" }, { renewalDate: "2025-02-29" },
  ];

  it.each(invalidFields)("rejects invalid create/update atomically: %j", async (invalid) => {
    const { a } = setup();
    const id = await a.mutation(api.subscriptions.create, fields);
    const before = await a.query(api.subscriptions.get, { id });
    await expect(a.mutation(api.subscriptions.create, { ...fields, ...invalid }))
      .rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
    await expect(a.mutation(api.subscriptions.update, { id, fields: { ...fields, ...invalid } }))
      .rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
    expect(await a.query(api.subscriptions.get, { id })).toEqual(before);
    expect((await a.query(api.subscriptions.list, { paginationOpts })).page).toEqual([before]);
  });

  it("accepts limits, both cycles, leap days and blank optional metadata", async () => {
    const { a } = setup();
    const longEmail = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
    expect(longEmail).toHaveLength(254);
    const id = await a.mutation(api.subscriptions.create, {
      ...fields, name: "🐗".repeat(80), plan: "x".repeat(80),
      paymentMethod: "y".repeat(80), reminderEmail: longEmail,
      amountCents: 9_999_999, billingCycle: "yearly",
      startDate: "2000-02-29", renewalDate: "2000-02-29",
    });
    expect(await a.query(api.subscriptions.get, { id })).toMatchObject({
      amountCents: 9_999_999, reminderEmail: longEmail, icon: { kind: "wallet" },
    });
    const minimumId = await a.mutation(api.subscriptions.create, {
      ...fields, amountCents: 1, plan: " ", paymentMethod: "", reminderEmail: "",
      category: " ", renewalDate: " ",
    });
    const minimum = await a.query(api.subscriptions.get, { id: minimumId });
    expect(minimum.amountCents).toBe(1);
    for (const key of ["plan", "paymentMethod", "reminderEmail", "category", "renewalDate"]) {
      expect(minimum).not.toHaveProperty(key);
    }
  });

  it.each(SUBSCRIPTION_CATEGORIES)("accepts category %s", async (category) => {
    const { a } = setup();
    const id = await a.mutation(api.subscriptions.create, { ...fields, category });
    expect(await a.query(api.subscriptions.get, { id })).toMatchObject({ category });
  });

  it.each(["https://example.com/icon.svg", "bad:../../icon", "prefix:", "prefix:bad?token=secret", "a".repeat(129)])(
    "rejects malformed icon identifiers: %s", async (name) => {
      const { a } = setup();
      await expect(a.mutation(api.subscriptions.create, {
        ...fields, icon: { kind: "iconify", name },
      })).rejects.toMatchObject({ data: { code: "INVALID_INPUT", field: "icon" } });
      expect((await a.query(api.subscriptions.list, { paginationOpts })).page).toEqual([]);
    },
  );

  it("rejects unsupported cycles, wrong primitive types and native image handles", async () => {
    const { a } = setup();
    type CreateArgs = Parameters<typeof a.mutation<typeof api.subscriptions.create>>[1];
    const malformed: unknown[] = [
      { ...fields, billingCycle: "weekly" },
      { ...fields, billingCycle: "Monthly" },
      { ...fields, amountCents: "9999" },
      { ...fields, name: null },
      { ...fields, startDate: 1706659200000 },
      { ...fields, icon: 12 },
      { ...fields, icon: { uri: "https://api.iconify.design/simple-icons/spotify.svg" } },
      { ...fields, ownerId: accountB.tokenIdentifier },
    ];
    for (const args of malformed) {
      // Deliberately cross the compile-time boundary to exercise wire validators.
      await expect(a.mutation(api.subscriptions.create, args as CreateArgs)).rejects.toThrow();
    }
    expect((await a.query(api.subscriptions.list, { paginationOpts })).page).toEqual([]);
  });

  it("keeps business validation errors free of submitted sensitive content", async () => {
    const { a } = setup();
    await expect(a.mutation(api.subscriptions.create, {
      ...fields, reminderEmail: "private-sensitive-value",
    })).rejects.toMatchObject({
      data: { code: "INVALID_INPUT", field: "reminderEmail", message: "Enter a valid reminder email." },
    });
  });
});

describe("decimal text to integer cents", () => {
  it.each([
    ["0.01", 1], ["99.99", 9999], ["99999.99", 9_999_999], [" 12.5 ", 1250],
    ["120", 12000], ["0001.01", 101], ["0.29", 29],
  ])("converts %s exactly to %s cents", (text, cents) => {
    expect(parseZarAmountCents(text)).toEqual({ ok: true, value: cents });
  });

  it.each(["", " ", "0", "-1", "1.005", "99.990", "100000", "1e2", "NaN", "Infinity", "1,000.00", "R12", "1.2x"])(
    "rejects %s without silently rounding", (text) => {
      expect(parseZarAmountCents(text)).toMatchObject({ ok: false, field: "amountCents" });
    },
  );
});
