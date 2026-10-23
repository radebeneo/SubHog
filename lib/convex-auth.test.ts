import assert from "node:assert/strict";
import test from "node:test";
import type { Auth, UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { requireIdentity, requireOwnedDocument } from "../convex/lib/auth.ts";

function context(identity: UserIdentity | null): { auth: Auth } {
  return { auth: { getUserIdentity: async () => identity } };
}

const alice: UserIdentity = {
  subject: "user_alice",
  issuer: "https://first.clerk.accounts.dev",
  tokenIdentifier: "https://first.clerk.accounts.dev|user_alice",
};

function errorCode(code: string) {
  return (error: unknown) => {
    if (!(error instanceof ConvexError)) return false;
    const data: unknown = error.data;
    return typeof data === "object" && data !== null && "code" in data && data.code === code;
  };
}

test("signed-out identity and owned-record access reject", async () => {
  await assert.rejects(requireIdentity(context(null)), errorCode("UNAUTHENTICATED"));
  await assert.rejects(
    requireOwnedDocument(context(null), { ownerId: alice.tokenIdentifier }),
    errorCode("UNAUTHENTICATED"),
  );
});

test("identity is supplied by the server auth context", async () => {
  assert.equal(await requireIdentity(context(alice)), alice);
});

test("only the verified owner can access a fetched document", async () => {
  const record = { ownerId: alice.tokenIdentifier, name: "Private record" };
  assert.equal(await requireOwnedDocument(context(alice), record), record);

  const bob = { ...alice, subject: "user_bob", tokenIdentifier: `${alice.issuer}|user_bob` };
  await assert.rejects(requireOwnedDocument(context(bob), record), errorCode("NOT_FOUND"));
});

test("same subject from another issuer does not share ownership", async () => {
  const otherIssuer = {
    ...alice,
    issuer: "https://second.clerk.accounts.dev",
    tokenIdentifier: "https://second.clerk.accounts.dev|user_alice",
  };
  await assert.rejects(
    requireOwnedDocument(context(otherIssuer), { ownerId: alice.tokenIdentifier }),
    errorCode("NOT_FOUND"),
  );
});

test("missing and foreign records return identical public errors", async () => {
  const results = await Promise.allSettled([
    requireOwnedDocument(context(alice), null),
    requireOwnedDocument(context(alice), { ownerId: "foreign" }),
  ]);
  const errors = results.map((result) => {
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") throw new Error("Expected rejection");
    assert.ok(result.reason instanceof ConvexError);
    return result.reason.data;
  });
  assert.deepEqual(errors[0], { code: "NOT_FOUND", message: "Record not found." });
  assert.deepEqual(errors[0], errors[1]);
});

test("an auth infrastructure failure does not become an authenticated identity", async () => {
  const ctx = { auth: { getUserIdentity: async () => { throw new Error("Unavailable"); } } };
  await assert.rejects(requireIdentity(ctx), /Unavailable/);
});
