import type { Auth, UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";

interface AuthContext {
  auth: Auth;
}

export async function requireIdentity(ctx: AuthContext): Promise<UserIdentity> {
  // Convex verifies the signature, issuer and audience before supplying identity.
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in to continue." });
  }
  return identity;
}

export async function requireOwnedDocument<T extends { ownerId: string }>(
  ctx: AuthContext,
  document: T | null,
): Promise<T> {
  const identity = await requireIdentity(ctx);
  // Missing and foreign records deliberately have the same public error.
  if (!document || document.ownerId !== identity.tokenIdentifier) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Record not found." });
  }
  return document;
}
