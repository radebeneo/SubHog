import { parseZarAmountCents, validateSubscriptionFields } from "./subscription-rules";
import type { SubscriptionDraft, SubscriptionDraftErrors } from "../types/subscription";
import type { SubscriptionFields, SubscriptionFieldsInput } from "../types/subscription-record";

const draftField = (field: keyof SubscriptionFieldsInput): keyof SubscriptionDraft =>
  field === "amountCents" ? "price" : field === "billingCycle" ? "frequency" : field;

export function parseSubscriptionForm(draft: SubscriptionDraft):
  | { ok: true; fields: SubscriptionFields }
  | { ok: false; errors: SubscriptionDraftErrors } {
  const amount = parseZarAmountCents(draft.price);
  if (!amount.ok) return { ok: false, errors: { price: amount.message } };
  const result = validateSubscriptionFields({
    name: draft.name,
    amountCents: amount.value,
    billingCycle: draft.frequency === "Monthly" ? "monthly" :
      draft.frequency === "Yearly" ? "yearly" : draft.frequency,
    startDate: draft.startDate,
    renewalDate: draft.renewalDate,
    plan: draft.plan,
    category: draft.category,
    paymentMethod: draft.paymentMethod,
    reminderEmail: draft.reminderEmail,
  });
  return result.ok
    ? { ok: true, fields: result.value }
    : { ok: false, errors: { [draftField(result.field === "icon" ? "name" : result.field)]: result.message } };
}

// Calendar-only values stay calendar-only. No UTC/local conversion on editing.
export function createPersistedSubscriptionDraft(subscription: Subscription): SubscriptionDraft {
  return {
    name: subscription.name,
    plan: subscription.plan ?? "",
    category: subscription.category ?? "",
    price: subscription.price.toFixed(2),
    frequency: subscription.frequency ?? (subscription.billing === "Yearly" ? "Yearly" : "Monthly"),
    startDate: subscription.startDate ?? "",
    renewalDate: subscription.renewalDate ?? "",
    paymentMethod: subscription.paymentMethod ?? "",
    reminderEmail: subscription.reminderEmail ?? "",
  };
}
