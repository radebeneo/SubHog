import dayjs from "dayjs";

export interface SubscriptionSummary {
  monthlySpend: number;
  nextRenewalDate: string | null;
  upcomingSubscriptions: (UpcomingSubscription & { renewalDate: string })[];
}

export function getNextRenewalDate(
  subscription: Subscription,
  now: dayjs.ConfigType = new Date(),
): string | null {
  if (subscription.status !== "active" || !subscription.renewalDate) return null;

  const anchor = dayjs(subscription.renewalDate);
  const today = dayjs(now).startOf("day");
  if (!anchor.isValid() || !today.isValid()) return null;
  if (!anchor.isBefore(today, "day")) return anchor.toISOString();

  const unit =
    subscription.billing === "Monthly"
      ? "month"
      : subscription.billing === "Yearly"
        ? "year"
        : null;
  if (!unit) return null;

  // Always add to the original anchor: Jan 31 -> Feb 28 -> Mar 31.
  let cycles = Math.max(0, today.diff(anchor, unit));
  let nextRenewal = anchor.add(cycles, unit);
  if (nextRenewal.isBefore(today, "day")) {
    cycles += 1;
    nextRenewal = anchor.add(cycles, unit);
  }
  return nextRenewal.toISOString();
}

export function getSubscriptionSummary(
  subscriptions: readonly Subscription[],
  now: dayjs.ConfigType = new Date(),
): SubscriptionSummary {
  const today = dayjs(now).startOf("day");
  const activeSubscriptions = subscriptions.filter(
    (subscription) => subscription.status === "active",
  );
  const monthlySpend = activeSubscriptions.reduce(
    (total, subscription) =>
      total +
      (subscription.billing === "Yearly"
        ? subscription.price / 12
        : subscription.price),
    0,
  );
  const upcomingSubscriptions = activeSubscriptions
    .flatMap((subscription) => {
      const renewalDate = getNextRenewalDate(subscription, now);
      if (!renewalDate) return [];
      return [{
        id: subscription.id,
        name: subscription.name,
        icon: subscription.icon,
        price: subscription.price,
        currency: subscription.currency,
        renewalDate,
        daysLeft: dayjs(renewalDate).startOf("day").diff(today, "day"),
      }];
    })
    .sort(
      (left, right) =>
        dayjs(left.renewalDate).valueOf() - dayjs(right.renewalDate).valueOf(),
    );

  return {
    monthlySpend,
    nextRenewalDate: upcomingSubscriptions[0]?.renewalDate ?? null,
    upcomingSubscriptions,
  };
}

export function formatRenewalCountdown(daysLeft: number): string {
  if (daysLeft === 0) return "Due Today";
  if (daysLeft === 1) return "Due Tomorrow";
  return `${daysLeft} days left`;
}
