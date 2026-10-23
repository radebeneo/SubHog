import assert from "node:assert/strict";
import test from "node:test";
import dayjs from "dayjs";
import {
  createSubscriptionDraft,
  parseSubscriptionDraft,
  validateSubscriptionDraft,
} from "./subscription-edit.ts";
import { deleteSubscriptionRecord, updateSubscriptionRecord } from "./subscription-state.ts";
import { getSubscriptionSummary } from "./subscription-summary.ts";

function record(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "first",
    name: "Netflix",
    icon: { uri: "https://example.com/icon.png" },
    color: "#f5c542",
    currency: "ZAR",
    price: 120,
    billing: "Monthly",
    frequency: "Monthly",
    status: "active",
    startDate: "2026-10-01T09:20:30",
    renewalDate: "2026-11-01T09:20:30",
    ...overrides,
  };
}

test("draft prefills all fields without changing stored dates or the source", () => {
  const original = record({ plan: "Premium", category: "Entertainment",
    paymentMethod: "Visa", reminderEmail: "reminders@example.com" });
  const draft = createSubscriptionDraft(original);
  assert.deepEqual(draft, {
    name: "Netflix", plan: "Premium", category: "Entertainment", price: "120",
    frequency: "Monthly", startDate: "2026-10-01", renewalDate: "2026-11-01",
    paymentMethod: "Visa", reminderEmail: "reminders@example.com",
  });
  const edits = parseSubscriptionDraft(draft, original);
  assert.equal(edits?.startDate, original.startDate);
  assert.equal(edits?.renewalDate, original.renewalDate);
  draft.name = "Unsaved";
  assert.equal(original.name, "Netflix");
  assert.equal(createSubscriptionDraft(original).name, "Netflix");
});

test("normalizes all editable fields and synchronizes the billing frequency", () => {
  const original = record();
  const draft = {
    ...createSubscriptionDraft(original),
    name: " Netflix Plus ", price: " 150,50 ", frequency: "Yearly" as const,
    plan: " Family ", category: " Music ", paymentMethod: " PayPal ",
    reminderEmail: " family@example.com ", startDate: "2026-09-01", renewalDate: "2027-09-01",
  };
  const edits = parseSubscriptionDraft(draft, original);
  assert.ok(edits);
  const [updated] = updateSubscriptionRecord([original], original.id, edits);
  assert.equal(updated.name, "Netflix Plus");
  assert.equal(updated.price, 150.5);
  assert.equal(updated.billing, "Yearly");
  assert.equal(updated.frequency, "Yearly");
  assert.equal(updated.plan, "Family");
  assert.equal(updated.category, "Music");
  assert.equal(updated.paymentMethod, "PayPal");
  assert.equal(updated.reminderEmail, "family@example.com");
  assert.equal(dayjs(updated.startDate).format("YYYY-MM-DD"), "2026-09-01");
  assert.equal(dayjs(updated.renewalDate).format("YYYY-MM-DD"), "2027-09-01");
});

test("rejects blank names and invalid, non-positive or non-decimal prices", () => {
  const original = record();
  const draft = createSubscriptionDraft(original);
  assert.ok(validateSubscriptionDraft({ ...draft, name: " " }).name);
  for (const price of ["", " ", "0", "-1", "NaN", "Infinity", "1e3", "0x10", "12abc", "12.3.4"]) {
    assert.ok(validateSubscriptionDraft({ ...draft, price }).price, price);
    assert.equal(parseSubscriptionDraft({ ...draft, price }, original), null);
  }
  assert.equal(validateSubscriptionDraft({ ...draft, price: "0.01" }).price, undefined);
});

test("strict calendar validation rejects rollovers and wrong formats", () => {
  const draft = createSubscriptionDraft(record());
  for (const date of ["", "2026-02-29", "2026-02-31", "2026-04-31",
    "2026-13-01", "2026-00-01", "2026-10-00", "23/10/2026", "2026-1-1", "invalid"]) {
    assert.ok(validateSubscriptionDraft({ ...draft, startDate: date }).startDate, date);
  }
  assert.equal(validateSubscriptionDraft({
    ...draft, startDate: "2024-02-29",
  }).startDate, undefined);
  assert.ok(validateSubscriptionDraft({ ...draft, renewalDate: "2026-02-31" }).renewalDate);
});

test("renewal may be blank or historical, but not before the start date", () => {
  const draft = createSubscriptionDraft(record());
  assert.equal(validateSubscriptionDraft({ ...draft, renewalDate: "" }).renewalDate, undefined);
  assert.ok(validateSubscriptionDraft({ ...draft, renewalDate: "2026-09-30" }).renewalDate);
  assert.deepEqual(validateSubscriptionDraft({
    ...draft, startDate: "2025-01-01", renewalDate: "2025-02-01",
  }), {});
  assert.deepEqual(validateSubscriptionDraft({
    ...draft, renewalDate: draft.startDate,
  }), {});
});

test("email is optional, validated, and clearable along with other optional fields", () => {
  const original = record({ reminderEmail: "old@example.com", paymentMethod: "Visa", plan: "Family" });
  const draft = createSubscriptionDraft(original);
  for (const reminderEmail of ["not-email", "a@", "@example.com", "a b@example.com", "a@example"]) {
    assert.ok(validateSubscriptionDraft({ ...draft, reminderEmail }).reminderEmail);
  }
  const edits = parseSubscriptionDraft({
    ...draft, reminderEmail: " ", paymentMethod: " ", plan: " ", category: " ",
    renewalDate: "",
  }, original);
  assert.ok(edits);
  const [updated] = updateSubscriptionRecord([original], original.id, edits);
  assert.equal(updated.reminderEmail, undefined);
  assert.equal(updated.paymentMethod, undefined);
  assert.equal(updated.plan, undefined);
  assert.equal(updated.category, undefined);
  assert.equal(updated.renewalDate, null);
});

test("updates preserve identity, metadata, order and untouched records", () => {
  const original = record();
  const second = record({ id: "second" });
  const records = [original, second];
  const edits = parseSubscriptionDraft({
    ...createSubscriptionDraft(original), price: "240",
  }, original);
  assert.ok(edits);
  const updated = updateSubscriptionRecord(records, original.id, edits);
  assert.deepEqual(updated.map((item) => item.id), ["first", "second"]);
  assert.equal(updated[0].icon, original.icon);
  assert.equal(updated[0].color, original.color);
  assert.equal(updated[0].currency, original.currency);
  assert.equal(updated[0].status, original.status);
  assert.equal(updated[1], second);
  assert.equal(original.price, 120);
  assert.deepEqual(updateSubscriptionRecord(records, "missing", edits), records);
  assert.deepEqual(updateSubscriptionRecord([], original.id, edits), []);
});

test("deletion targets only the selected ID and handles repeated or missing deletes", () => {
  const first = record();
  const second = record({ id: "second" });
  const records = [first, second];
  const remaining = deleteSubscriptionRecord(records, "first");
  assert.deepEqual(remaining, [second]);
  assert.equal(records.length, 2);
  assert.deepEqual(deleteSubscriptionRecord(remaining, "first"), [second]);
  assert.deepEqual(deleteSubscriptionRecord(records, "missing"), records);
  assert.deepEqual(deleteSubscriptionRecord(remaining, "second"), []);
});

test("edit and delete update derived monthly spend and renewal ordering", () => {
  const first = record({ renewalDate: "2026-11-01" });
  const second = record({ id: "second", price: 60, renewalDate: "2026-10-25" });
  const edits = parseSubscriptionDraft({
    ...createSubscriptionDraft(first), price: "2400", frequency: "Yearly", renewalDate: "2026-10-24",
  }, first);
  assert.ok(edits);
  const updated = updateSubscriptionRecord([first, second], first.id, edits);
  const summary = getSubscriptionSummary(updated, "2026-10-23");
  assert.equal(summary.monthlySpend, 260);
  assert.deepEqual(summary.upcomingSubscriptions.map((item) => item.id), ["first", "second"]);
  const afterDelete = getSubscriptionSummary(deleteSubscriptionRecord(updated, "first"), "2026-10-23");
  assert.equal(afterDelete.monthlySpend, 60);
  assert.deepEqual(afterDelete.upcomingSubscriptions.map((item) => item.id), ["second"]);
  assert.equal(getSubscriptionSummary(deleteSubscriptionRecord([first], "first")).monthlySpend, 0);
});
