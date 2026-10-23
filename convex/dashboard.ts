import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { requireIdentity } from "./lib/auth";
import { dashboardSummaryValidator } from "./lib/dashboardValidators";
import { calculateSubscriptionSummary, getJohannesburgDate } from "./lib/subscriptionCalculations";

// Resource guard only: never return a first-page total as a complete summary.
const maxSummarySubscriptions = 1000;

export const summary = query({
  args: { now: v.number(), upcomingLimit: v.optional(v.number()) },
  returns: dashboardSummaryValidator,
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const today = getJohannesburgDate(args.now);
    if (today === null) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        field: "now",
        message: "Provide an integer timestamp from 1970 through Johannesburg year 9999.",
      });
    }
    const upcomingLimit = args.upcomingLimit ?? 20;
    if (!Number.isInteger(upcomingLimit) || upcomingLimit < 1 || upcomingLimit > 100) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        field: "upcomingLimit",
        message: "Request 1 to 100 upcoming subscriptions.",
      });
    }

    const subscriptions = await ctx.db.query("subscriptions")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", identity.tokenIdentifier))
      .order("asc")
      .take(maxSummarySubscriptions + 1);
    if (subscriptions.length > maxSummarySubscriptions) {
      throw new ConvexError({
        code: "SUMMARY_LIMIT_EXCEEDED",
        message: "This account exceeds the current summary read limit. No partial totals are shown.",
      });
    }
    return calculateSubscriptionSummary(subscriptions, today, upcomingLimit);
  },
});
