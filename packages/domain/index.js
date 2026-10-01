import dayjs from "dayjs";

const renewalUnits = Object.freeze({
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
});

export function isNonNegativeMoneyAmount(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isPositiveMoneyAmount(value) {
  return isNonNegativeMoneyAmount(value) && value > 0;
}

export function groupRecurringAmounts(subscriptions) {
  const groups = subscriptions.reduce((result, subscription) => {
    const currency = subscription.currency || "ZAR";
    const key = `${currency}:${subscription.billing}`;
    const group = result[key] || {
      total: 0,
      currency,
      billing: subscription.billing,
    };
    group.total += subscription.price;
    result[key] = group;
    return result;
  }, {});

  return Object.entries(groups).sort(([first], [second]) =>
    first.localeCompare(second),
  );
}

export function getUpcomingRenewals(subscriptions, limit = 3) {
  return [...subscriptions]
    .filter((subscription) => subscription.renewalDate)
    .sort(
      (first, second) =>
        dayjs(first.renewalDate).valueOf() -
        dayjs(second.renewalDate).valueOf(),
    )
    .slice(0, limit);
}

export function calculateNextRenewalDate(startDate, frequency) {
  const unit = renewalUnits[frequency];
  if (!unit) throw new RangeError("Unsupported subscription frequency");
  return dayjs(startDate).add(1, unit).toISOString();
}