import type { SUBSCRIPTION_CATEGORIES } from "../constants/subscriptions";

export type SubscriptionCategory = (typeof SUBSCRIPTION_CATEGORIES)[number];
export type SubscriptionBillingCycle = "monthly" | "yearly";

export type SubscriptionIcon =
  | { kind: "wallet" }
  | { kind: "iconify"; name: string };

// Complete editable-field input. Omitted optional fields are cleared on update.
export interface SubscriptionFieldsInput {
  name: string;
  amountCents: number;
  billingCycle: SubscriptionBillingCycle;
  startDate: string;
  renewalDate?: string;
  plan?: string;
  category?: string;
  paymentMethod?: string;
  reminderEmail?: string;
}

export interface SubscriptionFields extends Omit<SubscriptionFieldsInput, "category"> {
  category?: SubscriptionCategory;
}

export type SubscriptionValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; field: keyof SubscriptionFieldsInput | "icon"; message: string };
