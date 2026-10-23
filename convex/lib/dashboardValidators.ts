import { v } from "convex/values";
import { billingCycleValidator, categoryValidator, iconValidator } from "./subscriptionValidators";

export const dashboardSummaryValidator = v.object({
  currency: v.literal("ZAR"),
  timeZone: v.literal("Africa/Johannesburg"),
  asOfDate: v.string(),
  activeSubscriptionCount: v.number(),
  monthlySpendCents: v.number(),
  annualSpendEstimateCents: v.number(),
  averageMonthlySpendCents: v.number(),
  categories: v.array(v.object({
    category: categoryValidator,
    subscriptionCount: v.number(),
    monthlySpendCents: v.number(),
    annualSpendEstimateCents: v.number(),
  })),
  nextRenewalDate: v.union(v.string(), v.null()),
  upcomingSubscriptions: v.array(v.object({
    id: v.id("subscriptions"),
    name: v.string(),
    amountCents: v.number(),
    billingCycle: billingCycleValidator,
    currency: v.literal("ZAR"),
    icon: iconValidator,
    color: v.string(),
    renewalDate: v.string(),
    daysLeft: v.number(),
  })),
  hasMoreUpcoming: v.boolean(),
});
