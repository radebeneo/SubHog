import { v } from "convex/values";
import { SUBSCRIPTION_CATEGORIES } from "../../constants/subscriptions";

export const billingCycleValidator = v.union(v.literal("monthly"), v.literal("yearly"));
export const categoryValidator = v.union(
  ...SUBSCRIPTION_CATEGORIES.map((category) => v.literal(category)),
);
export const iconValidator = v.union(
  v.object({ kind: v.literal("wallet") }),
  v.object({ kind: v.literal("iconify"), name: v.string() }),
);

export const subscriptionEditableValidator = v.object({
  name: v.string(),
  amountCents: v.number(),
  billingCycle: billingCycleValidator,
  startDate: v.string(),
  renewalDate: v.optional(v.string()),
  plan: v.optional(v.string()),
  // Normalize blanks before validating membership in the fixed category list.
  category: v.optional(v.string()),
  paymentMethod: v.optional(v.string()),
  reminderEmail: v.optional(v.string()),
});

export const subscriptionStoredValidator = subscriptionEditableValidator.extend({
  category: v.optional(categoryValidator),
  ownerId: v.string(),
  currency: v.literal("ZAR"),
  status: v.literal("active"),
  icon: iconValidator,
  color: v.string(),
});
