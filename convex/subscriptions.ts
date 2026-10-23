import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { SUBSCRIPTION_CATEGORY_COLORS } from "../constants/subscriptions";
import { validateSubscriptionFields, validateSubscriptionIcon } from "../lib/subscription-rules";
import type { SubscriptionValidationResult } from "../types/subscription-record";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireIdentity, requireOwnedDocument } from "./lib/auth";
import { iconValidator, subscriptionEditableValidator } from "./lib/subscriptionValidators";
import schema from "./schema";

function validated<T>(result: SubscriptionValidationResult<T>): T {
  if (!result.ok) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      field: result.field,
      message: result.message,
    });
  }
  return result.value;
}

async function ownedSubscription(
  ctx: QueryCtx,
  id: Id<"subscriptions">,
): Promise<Doc<"subscriptions">> {
  await requireIdentity(ctx);
  return await requireOwnedDocument(ctx, await ctx.db.get("subscriptions", id));
}

export const create = mutation({
  args: subscriptionEditableValidator.extend({ icon: v.optional(iconValidator) }).fields,
  returns: v.id("subscriptions"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const fields = validated(validateSubscriptionFields(args));
    const icon = validated(validateSubscriptionIcon(args.icon));
    return await ctx.db.insert("subscriptions", {
      ...fields,
      ownerId: identity.tokenIdentifier,
      currency: "ZAR",
      status: "active",
      icon,
      color: SUBSCRIPTION_CATEGORY_COLORS[fields.category ?? "Other"],
    });
  },
});

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("subscriptions")),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const { numItems } = args.paginationOpts;
    if (!Number.isInteger(numItems) || numItems < 1 || numItems > 100) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Request 1 to 100 subscriptions per page." });
    }
    return await ctx.db.query("subscriptions")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", identity.tokenIdentifier))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const get = query({
  args: { id: v.id("subscriptions") },
  returns: schema.doc("subscriptions"),
  handler: async (ctx, args) => await ownedSubscription(ctx, args.id),
});

export const update = mutation({
  args: { id: v.id("subscriptions"), fields: subscriptionEditableValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ownedSubscription(ctx, args.id);
    const fields = validated(validateSubscriptionFields(args.fields));
    // Explicit undefined values remove optional fields in a Convex patch.
    // Whitelist editable fields, preserving identity, visuals and creation order.
    await ctx.db.patch("subscriptions", args.id, fields);
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("subscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ownedSubscription(ctx, args.id);
    await ctx.db.delete("subscriptions", args.id);
    return null;
  },
});
