import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { createPersistedSubscriptionDraft, parseSubscriptionForm } from "../lib/subscription-form";
import { subscriptionOperationMessage } from "../lib/subscription-operation-error";
import type { SubscriptionDraft } from "../types/subscription";

const draft: SubscriptionDraft = {
  name: " Netflix ", price: "120.29", frequency: "Monthly",
  startDate: "2026-10-23", renewalDate: "2026-11-23",
  plan: " Premium ", category: "Entertainment",
  paymentMethod: " Visa ", reminderEmail: " reminders@example.com ",
};

describe("persisted subscription forms", () => {
  it("parses decimal components into exact integer cents and trims metadata", () => {
    const parsed = parseSubscriptionForm(draft);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("Expected valid form");
    expect(parsed.fields).toEqual({
      name: "Netflix", amountCents: 12029, billingCycle: "monthly",
      startDate: "2026-10-23", renewalDate: "2026-11-23",
      plan: "Premium", category: "Entertainment",
      paymentMethod: "Visa", reminderEmail: "reminders@example.com",
    });
  });

  it.each(["0", "-1", "1.001", "1,50", "1e3", "100000", ""])(
    "rejects unapproved amount %s without modifying the draft", (price) => {
      const input = { ...draft, price };
      const before = { ...input };
      expect(parseSubscriptionForm(input)).toMatchObject({ ok: false, errors: { price: expect.any(String) } });
      expect(input).toEqual(before);
    },
  );

  it.each([
    ["name", " ".repeat(3)], ["name", "a".repeat(81)], ["plan", "a".repeat(81)],
    ["category", "Invented"], ["startDate", "2026-02-30"],
    ["renewalDate", "2026-10-22"], ["reminderEmail", "invalid"],
  ] as const)("maps backend validation errors to draft field %s", (field, value) => {
    expect(parseSubscriptionForm({ ...draft, [field]: value })).toMatchObject({
      ok: false, errors: { [field]: expect.any(String) },
    });
  });

  it("clears all optional fields and preserves calendar-only dates", () => {
    const parsed = parseSubscriptionForm({
      ...draft, plan: "", category: "", paymentMethod: "", reminderEmail: "", renewalDate: "",
      frequency: "Yearly",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("Expected valid form");
    expect(parsed.fields).toMatchObject({ billingCycle: "yearly", startDate: "2026-10-23" });
    for (const key of ["plan", "category", "paymentMethod", "reminderEmail", "renewalDate"] as const) {
      expect(parsed.fields[key]).toBeUndefined();
    }
  });

  it("prefills cents and calendar dates without UTC conversion or source mutation", () => {
    const record: Subscription = {
      id: "record", name: "Service", icon: { uri: "https://example.com/icon.svg" },
      color: "#f5c542", price: 0.29, currency: "ZAR", status: "active",
      billing: "Yearly", frequency: "Yearly", startDate: "2024-02-29", renewalDate: null,
    };
    const before = { ...record };
    expect(createPersistedSubscriptionDraft(record)).toEqual({
      name: "Service", price: "0.29", frequency: "Yearly",
      startDate: "2024-02-29", renewalDate: "",
      plan: "", category: "", paymentMethod: "", reminderEmail: "",
    });
    expect(record).toEqual(before);
  });

  it.each(["INVALID_INPUT", "UNAUTHENTICATED", "NOT_FOUND"])(
    "classifies %s without displaying raw payload", (code) => {
      const message = subscriptionOperationMessage(new ConvexError({ code, secret: "private-value" }));
      expect(message).not.toContain("private-value");
      expect(message).not.toContain("could not be confirmed");
    },
  );

  it("redacts unknown errors and does not trust plain error-shaped objects", () => {
    const expected = "The change could not be confirmed. Reconnect and check your subscriptions before trying again.";
    expect(subscriptionOperationMessage(new Error("private-token"))).toBe(expected);
    expect(subscriptionOperationMessage({ data: { code: "NOT_FOUND" } })).toBe(expected);
  });
});
