# Subscription backend — Unit 2

## Approved scope

Implement the Convex subscription table and owned create/list/get/update/delete
functions, with validation and account-isolation tests. The existing Expo forms
and in-memory SubscriptionContext will connect to these functions in the next
unit. This document supersedes the historical REST contract for subscriptions.

Clerk remains the only authentication authority. Every function requires verified
identity; ownership is identity.tokenIdentifier (issuer + subject). Clients cannot
supply or change ownerId. Missing and foreign IDs return the same NOT_FOUND error.

## Approved product rules

- ZAR only; amounts are integer cents from 1 through 9,999,999 inclusive
  (R0.01–R99,999.99) per billing cycle.
- Monthly and Yearly only, stored once as billingCycle: "monthly" | "yearly".
- Decimal input must have at most two places; reject excess precision instead of
  rounding a subscription amount. Convert decimal text directly to integer cents.
- Required name: 1–80 characters after trimming.
- Optional plan and payment-method label: at most 80 characters after trimming.
- Optional reminder email: valid email format, at most 254 characters after
  trimming. Storage only; no email delivery.
- Optional category: Entertainment, Gaming, AI Tools, Developer Tools, Design,
  Productivity, Cloud, Music, or Other. Create and Edit will use the same choices.
- Blank optional text fields are absent. Character limits use Unicode code points.
- Required startDate and optional renewalDate use valid YYYY-MM-DD calendar dates.
  An explicit renewal anchor must be on or after startDate; past anchors are valid.
  No renewal anchor means the renewal is unknown; writes do not invent one.
- New subscriptions are active. Pause/cancel/reactivate controls are deferred.
- Deletion removes only the tracking record, never the provider subscription.

## Agreed calculation policy for the calculation unit

- Use Africa/Johannesburg to determine today's calendar date.
- Preserve the original renewal anchor and monthly/yearly billing day. Clamp a
  missing day to the end of its target month without changing the original anchor
  (January 31 → February 28/29 → March 31; leap-day yearly anchors recover in leap
  years).
- Calculate monthly-equivalent totals at full precision, rounding the final total
  only to the nearest cent, with half-cents rounded up. Stored amounts do not change.
  Use integer arithmetic (for example, twelfths of a cent) to avoid floating-point
  rounding drift.
- Backend calculations and dashboard/insight integration are subsequent units.

## Backend contract

- `subscriptions.create`: editable fields plus optional serializable icon; returns
  the new ID. Currency ZAR, status active, and ownership are server-controlled.
- `subscriptions.list`: owner-indexed newest-first native pagination; returns
  Convex pagination metadata and subscription documents. Page size is 1–100.
- `subscriptions.get`: owned ID lookup; returns one document.
- `subscriptions.update`: ID and a complete editable-field set; returns null.
  Omitted or blank optional fields are cleared. Name, amount, cycle, dates,
  category, plan, payment label and reminder email are editable.
- `subscriptions.remove`: owned ID deletion; returns null.

Updates preserve owner, currency, status, icon, initial color and creation order.
Icons are `{ kind: "wallet" }` or `{ kind: "iconify", name: "prefix:icon-name" }`.
The existing wallet fallback is selected when no icon is supplied. Iconify names
are validated identifiers, never arbitrary URLs, uploaded files or native asset
handles. Colors are selected on creation from the existing category palette and
preserved on edit, matching the current form behavior.

Argument validators reject unexpected fields, including ownership, status,
currency overrides and legacy price/frequency/billing fields. Business validation
returns bounded INVALID_INPUT errors without echoing supplied values. Validation,
authorization and writes run in the same Convex transaction.

## Verification

Use convex-test with Vitest and edge-runtime to call the registered functions.
Cover signed-out rejection, two-account and cross-issuer isolation, missing/foreign
ID equivalence, invalid create/update rollback, integer amount boundaries, text
limits, calendar dates, optional-field clearing, serializable icons and pagination.

These tests use mocked verified identities and an in-memory backend. They do not
prove JWT signature verification or device behavior. Live development sync verifies
the schema/functions compile and deploy; mobile persistence acceptance comes with
the app connection unit.

### Verified on 2026-10-23

- 76 Convex function/validation tests and 10 existing auth/configuration tests pass.
- `npx convex dev --once --typecheck enable` synchronized successfully to personal
  development deployment `flippant-dolphin-108` in `radebeneo17:subhog:dev/neo-radebe`.
- Public Convex HTTP queries to deployed `identity:current` and `subscriptions:list`,
  with no authentication token or admin identity, returned `UNAUTHENTICATED`.
- Ownership and write behavior were tested with mocked identities in convex-test;
  real-session subscription writes and mobile restart persistence await UI cutover.

Unit 1 user-reported acceptance: the Settings identity check succeeded for a second
account, and records cleared after restart and sign-out/sign-in as expected for the
current in-memory UI. Refresh/reconnect and invalid-JWT acceptance remain separate.
