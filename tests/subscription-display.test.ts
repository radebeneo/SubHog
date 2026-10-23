import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc } from "../convex/_generated/dataModel";

// Only the bundled native asset is stubbed; display/lookup/form code is real.
vi.mock("../constants/icons", () => ({ icons: { wallet: 123 } }));

import { displayConvexSubscription } from "../lib/convex-subscription-display";
import { createPersistedSubscriptionDraft, parseSubscriptionForm } from "../lib/subscription-form";
import { findSubscriptionIconRecord } from "../lib/subscription-icons";

const record: Doc<"subscriptions"> = {
  _id: "owned-id" as Doc<"subscriptions">["_id"],
  _creationTime: 1234,
  ownerId: "https://issuer.example|owner",
  name: "Service",
  amountCents: 12029,
  currency: "ZAR",
  billingCycle: "monthly",
  status: "active",
  startDate: "2026-10-23",
  renewalDate: "2026-11-23",
  category: "Entertainment",
  plan: "Premium",
  paymentMethod: "Visa",
  reminderEmail: "reminders@example.com",
  color: "#f5c542",
  icon: { kind: "iconify", name: "simple-icons:netflix" },
};

afterEach(() => vi.unstubAllGlobals());

describe("persisted document display (local adapter, not native rendering)", () => {
  it("preserves identity, cents, dates, metadata and the serializable Iconify source", () => {
    const before = structuredClone(record);
    expect(displayConvexSubscription(record)).toEqual({
      id: "owned-id", name: "Service", price: 120.29, currency: "ZAR",
      frequency: "Monthly", billing: "Monthly", status: "active",
      startDate: "2026-10-23", renewalDate: "2026-11-23",
      category: "Entertainment", plan: "Premium", paymentMethod: "Visa",
      reminderEmail: "reminders@example.com", color: "#f5c542",
      icon: { uri: "https://api.iconify.design/simple-icons/netflix.svg" },
    });
    expect(record).toEqual(before);
    expect(displayConvexSubscription(record)).not.toHaveProperty("ownerId");
  });

  it("uses the wallet asset and keeps yearly records with absent metadata editable", () => {
    const minimal: Doc<"subscriptions"> = {
      _id: record._id, _creationTime: record._creationTime, ownerId: record.ownerId,
      name: "Annual", amountCents: 29, currency: "ZAR", billingCycle: "yearly",
      status: "active", startDate: "2024-02-29", color: record.color,
      icon: { kind: "wallet" },
    };
    const displayed = displayConvexSubscription(minimal);
    expect(displayed).toMatchObject({
      icon: 123, frequency: "Yearly", billing: "Yearly", price: 0.29, renewalDate: null,
    });
    expect(parseSubscriptionForm(createPersistedSubscriptionDraft(displayed))).toEqual({
      ok: true,
      fields: { name: "Annual", amountCents: 29, billingCycle: "yearly", startDate: "2024-02-29" },
    });
  });

  it.each([1, 29, 12029, 9999999])("round-trips approved %s cents through display and editing", (amountCents) => {
    const parsed = parseSubscriptionForm(createPersistedSubscriptionDraft(
      displayConvexSubscription({ ...record, amountCents }),
    ));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("Expected a valid persisted draft");
    expect(parsed.fields.amountCents).toBe(amountCents);
  });
});

describe("serializable icon lookup (mocked HTTP, no live service claim)", () => {
  it("returns an exact safe Iconify name and ignores malformed response entries", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ icons: [null, 12, "../unsafe", "simple-icons:netflix"] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await findSubscriptionIconRecord(" Netflix ")).toEqual({
      kind: "iconify", name: "simple-icons:netflix",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the existing first-word fallback for a plan suffix", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ icons: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ icons: ["simple-icons:canva"] }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await findSubscriptionIconRecord("Canva Pro")).toEqual({
      kind: "iconify", name: "simple-icons:canva",
    });
    expect(fetchMock.mock.calls[1]?.[0]).toContain("query=Canva&");
  });

  it("returns a serializable wallet for empty, invalid or failed responses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ icons: ["bad/name", "x:UPPER"] }) })
      .mockRejectedValueOnce(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await findSubscriptionIconRecord("")).toEqual({ kind: "wallet" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await findSubscriptionIconRecord("Unknown")).toEqual({ kind: "wallet" });
    expect(await findSubscriptionIconRecord("Offline")).toEqual({ kind: "wallet" });
  });
});
