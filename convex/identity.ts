import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireIdentity } from "./lib/auth";

export const current = query({
  args: {},
  returns: v.object({
    subject: v.string(),
    issuer: v.string(),
  }),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    // Read-only; no user table, profile copy, provisioning or seeding.
    return { subject: identity.subject, issuer: identity.issuer };
  },
});
