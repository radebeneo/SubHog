export type BillingFrequency = "Monthly" | "Yearly";

export interface SubscriptionEdits {
  name: string;
  plan?: string;
  category?: string;
  price: number;
  frequency: BillingFrequency;
  startDate: string;
  renewalDate: string | null;
  paymentMethod?: string;
  reminderEmail?: string;
}

export interface SubscriptionDraft {
  name: string;
  plan: string;
  category: string;
  price: string;
  frequency: BillingFrequency;
  startDate: string;
  renewalDate: string;
  paymentMethod: string;
  reminderEmail: string;
}

export type SubscriptionDraftErrors = Partial<
  Record<keyof SubscriptionDraft, string>
>;
