import dayjs from "dayjs";
import type {
  SubscriptionDraft,
  SubscriptionDraftErrors,
  SubscriptionEdits,
} from "../types/subscription.ts";

export function createSubscriptionDraft(
  subscription: Subscription,
): SubscriptionDraft {
  return {
    name: subscription.name,
    plan: subscription.plan ?? "",
    category: subscription.category ?? "",
    price: String(subscription.price),
    frequency: subscription.frequency ??
      (subscription.billing === "Yearly" ? "Yearly" : "Monthly"),
    startDate: formatInputDate(subscription.startDate),
    renewalDate: formatInputDate(subscription.renewalDate),
    paymentMethod: subscription.paymentMethod ?? "",
    reminderEmail: subscription.reminderEmail ?? "",
  };
}

function formatInputDate(value?: string | null): string {
  if (!value) return "";
  const date = dayjs(value);
  return date.isValid() ? date.format("YYYY-MM-DD") : "";
}

function isCalendarDate(value: string): boolean {
  // Round-trip validation rejects normalized dates such as February 31.
  return /^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) &&
    dayjs(value).isValid() &&
    dayjs(value).format("YYYY-MM-DD") === value;
}

function savedDate(input: string, original?: string | null): string {
  // Preserve existing time and recurrence anchor when only other fields change.
  if (original && formatInputDate(original) === input) return original;
  return dayjs(input).startOf("day").toISOString();
}

export function validateSubscriptionDraft(
  draft: SubscriptionDraft,
): SubscriptionDraftErrors {
  const errors: SubscriptionDraftErrors = {};
  const price = draft.price.trim().replace(",", ".");
  if (!draft.name.trim()) errors.name = "Enter a subscription name.";
  if (!/^\d+(\.\d+)?$/.test(price) ||
      !Number.isFinite(Number(price)) || Number(price) <= 0) {
    errors.price = "Enter a price greater than zero.";
  }
  if (draft.frequency !== "Monthly" && draft.frequency !== "Yearly") {
    errors.frequency = "Choose Monthly or Yearly.";
  }

  const startDate = draft.startDate.trim();
  const renewalDate = draft.renewalDate.trim();
  if (!isCalendarDate(startDate)) {
    errors.startDate = "Enter a valid date in YYYY-MM-DD format.";
  }
  if (renewalDate && !isCalendarDate(renewalDate)) {
    errors.renewalDate = "Enter a valid date in YYYY-MM-DD format.";
  } else if (renewalDate && !errors.startDate && renewalDate < startDate) {
    errors.renewalDate = "Renewal date cannot be before the start date.";
  }

  const email = draft.reminderEmail.trim();
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) {
    errors.reminderEmail = "Enter a valid email address or leave this blank.";
  }
  return errors;
}

export function parseSubscriptionDraft(
  draft: SubscriptionDraft,
  original: Subscription,
): SubscriptionEdits | null {
  if (Object.keys(validateSubscriptionDraft(draft)).length > 0) return null;
  return {
    name: draft.name.trim(),
    plan: draft.plan.trim() || undefined,
    category: draft.category.trim() || undefined,
    price: Number(draft.price.trim().replace(",", ".")),
    frequency: draft.frequency,
    startDate: savedDate(draft.startDate.trim(), original.startDate),
    renewalDate: draft.renewalDate.trim()
      ? savedDate(draft.renewalDate.trim(), original.renewalDate)
      : null,
    paymentMethod: draft.paymentMethod.trim() || undefined,
    reminderEmail: draft.reminderEmail.trim() || undefined,
  };
}
