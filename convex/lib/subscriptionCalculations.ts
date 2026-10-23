import type { Infer } from "convex/values";
import { SUBSCRIPTION_CATEGORIES } from "../../constants/subscriptions";
import { isCalendarDate } from "../../lib/subscription-rules";
import type { SubscriptionBillingCycle, SubscriptionCategory } from "../../types/subscription-record";
import type { Doc } from "../_generated/dataModel";
import type { dashboardSummaryValidator } from "./dashboardValidators";

type DashboardSummary = Infer<typeof dashboardSummaryValidator>;
const dayMilliseconds = 86_400_000;
const johannesburgOffsetMilliseconds = 2 * 60 * 60 * 1000;
export const maxSummaryTimestamp = Date.UTC(10000, 0, 1) - johannesburgOffsetMilliseconds - 1;

// Johannesburg has fixed UTC+02:00 throughout the supported modern range.
// Explicit UTC operations avoid host timezone and unavailable Intl APIs.
export function getJohannesburgDate(now: number): string | null {
  if (!Number.isSafeInteger(now) || now < 0 || now > maxSummaryTimestamp) return null;
  return new Date(now + johannesburgOffsetMilliseconds).toISOString().slice(0, 10);
}

function dateParts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function clampedDate(year: number, month: number, day: number): string | null {
  if (year > 9999) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(Math.min(day, monthDays[month - 1])).padStart(2, "0")}`;
}

export function getNextRenewalDate(
  anchor: string | undefined,
  billingCycle: SubscriptionBillingCycle,
  today: string,
): string | null {
  if (!anchor || !isCalendarDate(anchor) || !isCalendarDate(today)) return null;
  if (anchor >= today) return anchor;

  const original = dateParts(anchor);
  const current = dateParts(today);
  if (billingCycle === "yearly") {
    const candidate = clampedDate(current.year, original.month, original.day);
    return candidate !== null && candidate >= today
      ? candidate
      : clampedDate(current.year + 1, original.month, original.day);
  }

  const candidate = clampedDate(current.year, current.month, original.day);
  if (candidate !== null && candidate >= today) return candidate;
  const nextMonth = current.month === 12 ? 1 : current.month + 1;
  const nextYear = current.month === 12 ? current.year + 1 : current.year;
  return clampedDate(nextYear, nextMonth, original.day);
}

function calendarDayNumber(date: string): number {
  const { year, month, day } = dateParts(date);
  const instant = new Date(0);
  // Date.UTC treats years 0–99 as 1900–1999; setUTCFullYear does not.
  instant.setUTCFullYear(year, month - 1, day);
  return instant.getTime() / dayMilliseconds;
}

// Only integer numerators/divisors enter this operation. No per-record rounding.
function roundHalfUp(numerator: number, divisor: number): number {
  const whole = Math.floor(numerator / divisor);
  return whole + (numerator % divisor >= Math.ceil(divisor / 2) ? 1 : 0);
}

export function calculateSubscriptionSummary(
  subscriptions: readonly Doc<"subscriptions">[],
  today: string,
  upcomingLimit: number,
): DashboardSummary {
  let totalTwelfths = 0;
  let activeSubscriptionCount = 0;
  const categoryTotals = new Map<SubscriptionCategory, { twelfths: number; count: number }>();
  const upcoming: DashboardSummary["upcomingSubscriptions"] = [];
  const todayNumber = calendarDayNumber(today);

  for (const subscription of subscriptions) {
    if (subscription.status !== "active") continue;
    activeSubscriptionCount += 1;
    const twelfths = subscription.amountCents * (subscription.billingCycle === "monthly" ? 12 : 1);
    totalTwelfths += twelfths;
    const category = subscription.category ?? "Other";
    const previous = categoryTotals.get(category) ?? { twelfths: 0, count: 0 };
    categoryTotals.set(category, {
      twelfths: previous.twelfths + twelfths,
      count: previous.count + 1,
    });

    const renewalDate = getNextRenewalDate(subscription.renewalDate, subscription.billingCycle, today);
    if (renewalDate === null) continue;
    upcoming.push({
      id: subscription._id,
      name: subscription.name,
      amountCents: subscription.amountCents,
      billingCycle: subscription.billingCycle,
      currency: subscription.currency,
      icon: subscription.icon,
      color: subscription.color,
      renewalDate,
      daysLeft: calendarDayNumber(renewalDate) - todayNumber,
    });
  }

  // Stable sort preserves ascending indexed creation order for equal dates.
  upcoming.sort((left, right) => left.renewalDate < right.renewalDate ? -1 : left.renewalDate > right.renewalDate ? 1 : 0);
  const categories = SUBSCRIPTION_CATEGORIES
    .filter((category) => categoryTotals.has(category))
    .sort((left, right) => categoryTotals.get(right)!.twelfths - categoryTotals.get(left)!.twelfths)
    .map((category) => {
      const totals = categoryTotals.get(category)!;
      return {
        category,
        subscriptionCount: totals.count,
        monthlySpendCents: roundHalfUp(totals.twelfths, 12),
        annualSpendEstimateCents: totals.twelfths,
      };
    });

  return {
    currency: "ZAR",
    timeZone: "Africa/Johannesburg",
    asOfDate: today,
    activeSubscriptionCount,
    monthlySpendCents: roundHalfUp(totalTwelfths, 12),
    annualSpendEstimateCents: totalTwelfths,
    averageMonthlySpendCents: activeSubscriptionCount === 0
      ? 0
      : roundHalfUp(totalTwelfths, 12 * activeSubscriptionCount),
    categories,
    nextRenewalDate: upcoming[0]?.renewalDate ?? null,
    upcomingSubscriptions: upcoming.slice(0, upcomingLimit),
    hasMoreUpcoming: upcoming.length > upcomingLimit,
  };
}
