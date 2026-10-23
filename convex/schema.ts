import { defineSchema, defineTable } from "convex/server";
import { subscriptionStoredValidator } from "./lib/subscriptionValidators";

export default defineSchema({
  subscriptions: defineTable(subscriptionStoredValidator).index("by_ownerId", ["ownerId"]),
});
