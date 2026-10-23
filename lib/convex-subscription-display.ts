import { icons } from "@/constants/icons";
import type { Doc } from "@/convex/_generated/dataModel";

export function displayConvexSubscription(record: Doc<"subscriptions">): Subscription {
  const frequency = record.billingCycle === "yearly" ? "Yearly" : "Monthly";
  return {
    id: record._id,
    name: record.name,
    price: record.amountCents / 100,
    currency: record.currency,
    frequency,
    billing: frequency,
    startDate: record.startDate,
    renewalDate: record.renewalDate ?? null,
    plan: record.plan,
    category: record.category,
    paymentMethod: record.paymentMethod,
    reminderEmail: record.reminderEmail,
    status: record.status,
    color: record.color,
    icon: record.icon.kind === "iconify"
      ? { uri: `https://api.iconify.design/${record.icon.name.replace(":", "/")}.svg` }
      : icons.wallet,
  };
}
