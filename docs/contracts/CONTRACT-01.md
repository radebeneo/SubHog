# CONTRACT-01: Clerk Identity and Owned Subscriptions

**Status:** Canonical cross-application contract

This is the sole human-readable contract for Clerk identity and owned
subscriptions in this repository. Clerk is the identity authority. MongoDB is
authoritative for API users, Clerk associations, and subscriptions.

## API compatibility and versioning

The routes in this contract are under `/api/v1`. Deployed mobile clients depend
on their paths, status codes, envelopes, field names, enum values, nullability,
and list behavior. A breaking change must not be shipped in place. It requires
an explicit API version, a client migration and compatibility rollout, and
retirement only after deployed clients have moved to the new version.

In particular, `GET /api/v1/subscriptions/user/:id` remains an unpaginated
complete-array response. Pagination, cursor metadata, a wrapper other than the
current success envelope, or a partial result is a breaking change and requires
that versioned rollout.

## Clerk credential policy

The API verifies one `Authorization: Bearer TOKEN` credential directly with
`jose` `5.10.0`, which is installed in the API. Verification uses `jwtVerify`
and a remote JWKS-backed key set. There is no token exchange, second API session
system, dual verifier, or legacy-JWT fallback for Clerk-protected routes.

The verifier enforces the configured algorithm allowlist, exact issuer,
audience, future `exp`, reasonable `iat`, valid optional `nbf`, and a non-empty
Clerk `sub`. The exact `sub` is the only identity identifier read from the
credential. Tokens, keys, provider secrets, and authorization headers must
never be logged, returned, or included in errors.

Authorized-party policy is explicit configuration. Clerk's `azp` claim may be
absent on native requests that do not carry an `Origin` header. The policy must
therefore be selected from observed, signature-verified tokens issued by the
real production and development Clerk instances to the iOS and Android
applications. Request headers, including `Origin`, are not evidence of what a
signed token should contain and must not be used to infer or weaken the policy.
Each environment must either require an observed `azp` from its configured
allowlist or require `azp` to be absent; it must not accept both shapes as an
implicit fallback.

Verification configuration includes `CLERK_JWKS_URL`, `CLERK_ISSUER`,
`CLERK_AUDIENCE`, `CLERK_ALLOWED_ALGORITHMS`,
`CLERK_AUTHORIZED_PARTY_POLICY`, the conditionally required
`CLERK_AUTHORIZED_PARTIES`, and bounded clock-skew and JWKS
timeout/refresh/cache values. `CLERK_SECRET_KEY` is server-only and is used only
for Clerk User API profile retrieval. `CLERK_API_BASE_URL` is pinned server
configuration and is never request-controlled.

Authentication failures are separated:

- `401 AUTH_INVALID` means the credential is missing, malformed, has an
  unacceptable signature or claims, or has no matching permitted key after a
  successful JWKS retrieval and bounded refresh.
- `503 AUTH_PROVIDER_UNAVAILABLE` means required verification infrastructure
  could not be obtained, including JWKS timeout, network or TLS failure,
  malformed provider key-set response, or exhausted refresh when the key set
  could not be retrieved.

An unverified token is never accepted.

## Identity invariants

The existing `User` document stores the server-controlled Clerk association:

```json
{
  "identityProvider": "clerk",
  "providerSubject": "user_2abc123"
}
```

`providerSubject` is the exact verified Clerk `sub`, and `identityProvider` is
`clerk`. The pair `(identityProvider, providerSubject)` has a unique partial
index covering documents where both fields exist. The fields are immutable
after provisioning and are never accepted from a client.

The association lookup, not email or a route parameter, determines the API
user for every Clerk-protected operation. Email remains profile data and a
conflict check. There is no email-only linking, implicit linking, account
merging, or fake password. Legacy users without an association retain their
legacy behavior, but legacy credentials do not authorize Clerk-protected
subscription routes.

Public user serialization is allowlisted. It may expose `_id`, `name`, `email`,
`createdAt`, and `updatedAt` as appropriate. It excludes `password`,
`identityProvider`, `providerSubject`, and future credential/provider fields.
Identity responses may expose the separately contracted provider and subject
values, but never credentials or secrets.

## Trusted provisioning

`GET /api/v1/identity` is read-only. It verifies the Clerk credential and reads
the inline association without retrieving a Clerk profile or writing data.

```json
{
  "success": true,
  "data": {
    "provider": "clerk",
    "clerkUserId": "user_2abc123",
    "userId": "665f00000000000000000001",
    "provisioned": true
  }
}
```

An authenticated, unprovisioned identity returns `200` with `userId: null` and
`provisioned: false`. An identity database read failure returns:

```json
{
  "success": false,
  "code": "IDENTITY_RESOLUTION_FAILED",
  "message": "Identity resolution failed"
}
```

`POST /api/v1/identity/provision` requires a valid Clerk credential and an
absent or empty-object body. Unexpected fields return `400 REQUEST_INVALID`.
The API retrieves the profile server-to-server from the pinned Clerk User API;
name and email claims in the bearer token are not trusted for provisioning.

The profile's primary email ID must resolve to a verified email entry. Email is
trimmed and lowercased. Name derivation trims `first_name` and `last_name` and
joins non-empty parts with one space. The resulting user name must contain 2
through 20 characters. It is never invented or truncated. Invalid profile
email returns `422 PROFILE_EMAIL_UNVERIFIED`; an absent or invalid name returns
`422 PROFILE_INCOMPLETE`.

First provisioning creates one associated user and returns `201`. Repeating
provisioning for the same subject returns the unchanged safe projection with
`200`; it does not silently synchronize profile fields. The unique association
index and atomic/concurrency-safe handling prevent duplicate users. An existing
unassociated legacy user with the profile email returns
`409 LEGACY_EMAIL_CONFLICT`; an association conflict returns
`409 IDENTITY_CONFLICT`. No conflict path links, merges, overwrites, or deletes
a user.

```json
{
  "success": true,
  "data": {
    "provider": "clerk",
    "clerkUserId": "user_2abc123",
    "userId": "665f00000000000000000001",
    "email": "owner@example.test",
    "name": "Owner Example"
  }
}
```

Provider dependency failures return `503 AUTH_PROVIDER_UNAVAILABLE`; internal
provisioning database failures return `500 PROVISIONING_FAILED`.

## Common envelopes

Successful JSON responses use:

```json
{"success": true, "data": {}}
```

Errors use this shape without sensitive or internal fields:

```json
{"success": false, "code": "ERROR_CODE", "message": "Stable client-safe message"}
```

`DELETE /api/v1/subscriptions/:id` is the exception: success is `204 No
Content` with no response body.

## Subscription representation

Subscription output is an explicit allowlist:

```json
{
  "_id": "665f00000000000000000010",
  "name": "Example Plus",
  "price": 12.5,
  "currency": "USD",
  "frequency": "monthly",
  "category": "entertainment",
  "paymentMethod": "card",
  "status": "active",
  "startDate": "2026-01-01T00:00:00.000Z",
  "renewalDate": "2026-02-01T00:00:00.000Z",
  "user": "665f00000000000000000001",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

The enums are:

- `currency`: `USD | GBP | ZAR`
- `frequency`: `daily | weekly | monthly | yearly`
- `category`: `sports | news | entertainment | education | health | others`
- `status`: `active | cancelled | expired`

`paymentMethod` is a required non-empty string, not an enum. IDs are strings.
`startDate`, `createdAt`, and `updatedAt` are UTC ISO 8601 strings.
`renewalDate` is either a UTC ISO 8601 string or `null` for representable legacy
records. `workflowRunId` and all non-allowlisted persistence fields are omitted.
A record that cannot be safely represented returns `500 DATA_INTEGRITY_ERROR`;
the API does not return a partial or widened projection.

## Complete owned list

### `GET /api/v1/subscriptions/user/:id`

This route is Clerk-protected. It resolves the verified Clerk subject to the
associated API user and requires `:id` to equal that user's ID. Authentication
happens before route-ID validation or data access.

An authenticated but unprovisioned identity returns
`403 IDENTITY_NOT_PROVISIONED`. A malformed user ID returns
`422 INVALID_USER_ID`; a valid ID belonging to a different user returns
`403 NOT_OWNER`; a missing associated API user or equivalent association
inconsistency returns `404 USER_NOT_FOUND`.

Success is `200` with the complete owned subscription array in the current
envelope:

```json
{
  "success": true,
  "data": []
}
```

The route is intentionally unpaginated. `data` contains every representable
owned subscription, ordered by `createdAt` descending and then `_id`
descending. No subscriptions is `200` with `data: []`. A database failure
returns `500 SUBSCRIPTIONS_READ_FAILED`, not an empty or partial array.

## Owned item routes

The following routes are Clerk-protected:

- `GET /api/v1/subscriptions/:id`
- `PUT /api/v1/subscriptions/:id`
- `DELETE /api/v1/subscriptions/:id`
- `PUT /api/v1/subscriptions/:id/cancel`

After Clerk authentication, each route resolves the inline association and
uses the associated API user ID as the owner. The subscription must be read,
updated, cancelled, or deleted with an owner-scoped compound predicate
equivalent to `{ _id: subscriptionId, user: associatedUserId }`. The
implementation must not fetch by subscription ID and authorize afterward.

Malformed IDs, nonexistent subscriptions, and subscriptions owned by another
user all produce the same `404 SUBSCRIPTION_NOT_FOUND` status, envelope,
message, and observable behavior. This indistinguishability prevents callers
from discovering another user's subscription IDs. No path may return
`403 NOT_OWNER` for an item route.

`GET /api/v1/subscriptions/:id` returns `200` with one allowlisted subscription
DTO in the success envelope.

`PUT /api/v1/subscriptions/:id` accepts only these fields:

- `name`
- `price`
- `currency`
- `frequency`
- `category`
- `paymentMethod`
- `startDate`
- `renewalDate`

At least one allowlisted field is required. Client-controlled `_id`, `user`,
`status`, `workflowRunId`, timestamps, identity fields, and every unknown field
are rejected with `400 REQUEST_INVALID`. Input enums match the output enums,
money is a finite non-negative number, and input dates must be valid dates
consistent with subscription date invariants.

A subscription `name`, after surrounding whitespace is trimmed, must be 2
through 100 characters. The API never truncates it. Mobile clients must
prevalidate the same 2-through-100 constraint and all other known input
constraints for immediate feedback, but server validation remains
authoritative. Success is `200` with the complete allowlisted updated DTO in
the success envelope.

`PUT /api/v1/subscriptions/:id/cancel` accepts only an absent or empty-object
body. Any field returns `400 REQUEST_INVALID`. It owner-scopes the update and
sets `status` to `cancelled`; success is `200` with the complete allowlisted
subscription DTO in the success envelope. Repeating cancellation on an already
cancelled owned subscription remains successful and returns its current DTO.

`DELETE /api/v1/subscriptions/:id` accepts only an absent or empty-object body.
Any field returns `400 REQUEST_INVALID`. It uses an owner-scoped compound
delete. Success is `204 No Content` with an empty body.

All item-route reads and writes use explicit database projections or response
serialization allowlists. They never expose `workflowRunId`, identity data,
credentials, provider fields, or other persistence internals.

## Workflow and preservation

Upstash QStash is the reminder delivery/orchestration service and
`@upstash/workflow` is the server SDK. `workflowRunId` is internal persistence
used by reminder triggering; it is not a Clerk credential, Clerk session, or
public subscription field. This contract does not change callback verification
or reminder behavior.

Rollbacks and deployments preserve existing users, inline identity
associations, emails, passwords, and subscriptions. Failed provisioning or
subscription mutations roll back only their own uncommitted writes. Repair,
unlinking, or destructive migration requires a separately reviewed,
backed-up, auditable operator process.
