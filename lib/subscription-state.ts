import type { SubscriptionEdits } from "../types/subscription.ts";

export function updateSubscriptionRecord(
  subscriptions: readonly Subscription[],
  id: string,
  edits: SubscriptionEdits,
): Subscription[] {
  return subscriptions.map((subscription) =>
    subscription.id === id
      ? { ...subscription, ...edits, billing: edits.frequency }
      : subscription,
  );
}

export function deleteSubscriptionRecord(
  subscriptions: readonly Subscription[],
  id: string,
): Subscription[] {
  return subscriptions.filter((subscription) => subscription.id !== id);
}
