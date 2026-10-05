
import dayjs from "dayjs";

/**
 * Formats a given value as a currency string.
 * Defaults to South African Rand (ZAR) formatting.
 *
 * @param value - The numerical or string value to format.
 * @param currency - The currency code to use (default: "ZAR").
 * @returns The formatted currency string.
 */
export const formatCurrency = (value: number | string, currency: string = "ZAR"): string => {
  try {
    const numericValue = typeof value === "string" ? parseFloat(value) : value;

    if (isNaN(numericValue)) {
      throw new Error("Invalid number provided");
    }

    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  } catch {
    // Fallback in case of an error (e.g., unsupported currency code or invalid number)
    let safeValue = 0;
    if (typeof value === "number" && !isNaN(value)) {
      safeValue = value;
    } else if (typeof value === "string") {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        safeValue = parsed;
      }
    }

    const prefix = currency === "ZAR" ? "R" : `${currency} `;
    return `${prefix}${safeValue.toFixed(2)}`;
  }
};

export const formatSubscriptionDateTime = (value?: string): string => {
  if (!value) return "Not provided";
  const parsedDate = dayjs(value);
  return parsedDate.isValid() ? parsedDate.format("MM/DD/YYYY") : "Not provided";
};

export const formatStatusLabel = (value?: string): string => {
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export const getRenewalDays = (
  renewalDate: string,
  now: string | Date = new Date(),
): number =>
  dayjs(renewalDate).startOf("day").diff(dayjs(now).startOf("day"), "day");

export const formatRenewalDueLabel = (days: number): string => {
  if (days < 0) {
    const overdueDays = Math.abs(days);
    return `Overdue by ${overdueDays} ${overdueDays === 1 ? "day" : "days"}`;
  }
  if (days === 0) return "Due Today";
  if (days === 1) return "Due Tomorrow";
  return `${days} days left`;
};

interface RenewalSubscription<TIcon> {
  id: string;
  icon: TIcon;
  name: string;
  price: number;
  currency?: string;
  status?: string;
  renewalDate?: string | null;
}

interface UpcomingRenewal<TIcon> {
  id: string;
  icon: TIcon;
  name: string;
  price: number;
  currency?: string;
  daysLeft: number;
}

export const getUpcomingSubscriptions = <TIcon>(
  subscriptions: RenewalSubscription<TIcon>[],
  now: string | Date = new Date(),
): UpcomingRenewal<TIcon>[] =>
  subscriptions
    .filter(
      (subscription) =>
        subscription.status === "active" &&
        Boolean(subscription.renewalDate) &&
        dayjs(subscription.renewalDate).isValid(),
    )
    .map((subscription) => ({
      id: subscription.id,
      icon: subscription.icon,
      name: subscription.name,
      price: subscription.price,
      currency: subscription.currency,
      daysLeft: getRenewalDays(subscription.renewalDate!, now),
    }))
    .sort((first, second) => first.daysLeft - second.daysLeft);
