import type { SubscriptionFrequency } from "@subhog/contracts";

export interface RecurringAmountSubscription {
  price: number;
  currency?: string | null;
  billing: string;
}

export interface RecurringAmountGroup {
  total: number;
  currency: string;
  billing: string;
}

export interface UpcomingRenewal {
  renewalDate?: string | null;
}

export declare function isNonNegativeMoneyAmount(value: unknown): boolean;
export declare function isPositiveMoneyAmount(value: unknown): boolean;
export declare function groupRecurringAmounts(
  subscriptions: readonly RecurringAmountSubscription[],
): [string, RecurringAmountGroup][];
export declare function getUpcomingRenewals<T extends UpcomingRenewal>(
  subscriptions: readonly T[],
  limit?: number,
): T[];
export declare function calculateNextRenewalDate(
  startDate: Date | string | number,
  frequency: SubscriptionFrequency,
): string;