# Backend subscription calculations — Unit 4

## Scope

Implement/test Convex calculations only. Home/Insights wiring, notification or
reminder delivery, lifecycle controls and remaining Unit 3 device acceptance
are separate. No schema changes, data backfills, new packages or demo seeds.

## Query contract

`api.dashboard.summary({ now, upcomingLimit? })` requires verified Clerk identity.
Ownership comes exclusively from `identity.tokenIdentifier`; no owner argument
is accepted. `now` is an integer epoch-millisecond instant from 1970 through
the last representable Johannesburg calendar day in year 9999. The query does
not read Date.now, so identical arguments and records give identical results.
The future client integration must refresh now at Johannesburg midnight and on
focus/resume; Convex subscription writes trigger ordinary reactive query updates.

Returns:
- `currency: "ZAR"`, `timeZone: "Africa/Johannesburg"`, `asOfDate: YYYY-MM-DD`
- `activeSubscriptionCount`
- `monthlySpendCents`, `annualSpendEstimateCents`, `averageMonthlySpendCents`
- `categories`: populated categories with category, subscriptionCount,
  monthlySpendCents and annualSpendEstimateCents
- `nextRenewalDate`: YYYY-MM-DD or null
- `upcomingSubscriptions`: id, name, amountCents, billingCycle, currency, icon,
  color, renewalDate (the calculated occurrence), daysLeft
- `hasMoreUpcoming`: whether additional known renewals were omitted

Upcoming defaults to 20 entries; an optional integer limit is 1–100. The nearest
date and complete totals are calculated before this output limit. Equal dates
retain ascending owner-index creation order, including after edits. Sensitive
metadata (ownerId, plan, paymentMethod, reminderEmail) is not returned.

## Money

Only active records contribute (the current schema permits active records only).
For each record, monthly cents contribute amountCents × 12 integer twelfths;
yearly cents contribute amountCents twelfths. Sum first, then divide by 12 and
round half-up once. Annual estimate equals the same twelfths numerator in cents:
monthly amounts × 12 plus yearly amounts. It is an annualized run-rate, not
a historical payment report or an exact next-12-month cash-flow forecast.

Category totals follow the same rule; absent category joins Other. Sort by the
unrounded numerator descending, using existing category order for exact ties.
Average divides the unrounded numerator by 12 × count before half-up rounding.
Each displayed total is independently rounded, so displayed category cents need
not add up to displayed account cents. Never sum rounded per-record or category
values to calculate the account total, or multiply rounded monthly cents by 12
to calculate annual cents. Empty accounts have zero totals and empty arrays.

## Calendar

Modern Africa/Johannesburg uses fixed UTC+02:00 with no daylight-saving time.
Explicit UTC getters/ISO dates avoid depending on the server/device timezone;
no Intl or timezone dependency is required for the supported timestamp range.

Renewal is the first anchored occurrence on or after the Johannesburg date.
An anchor on today is due today (daysLeft 0), regardless of time of day.
Future anchors remain unchanged; past anchors advance monthly/yearly directly
from the original anchor. Clamp only the target month's day, never the anchor:
January 31 → February 28/29 → March 31; February 29 yearly → February 28 in
non-leap years → February 29 in leap years. Gregorian century rules apply.

Unknown/missing anchors remain null and do not enter Upcoming, but their amounts
still contribute to spending. Invalid legacy anchors are treated as unknown;
the current write API rejects them. An occurrence beyond year 9999 is also null.

## Safety and scale

Read at most 1001 records through by_ownerId. If more than 1000 owned records
exist, throw SUMMARY_LIMIT_EXCEEDED and return no partial summary. This is a
query-resource guard, not a subscription limit; CRUD/native pagination are
unchanged. Larger accounts need a separately approved aggregate component and
backfill, rather than silently taking the first page or an unbounded scan.

All integer numerators are safely below Number.MAX_SAFE_INTEGER under this
guard and approved amount limits. Invalid now/limit arguments return bounded
INVALID_INPUT errors. Unauthorized calls return UNAUTHENTICATED.

## Verification

Use deterministic convex-test/Vitest edge-runtime tests through generated API
references. Cover empty/mixed accounts, cent remainders and half-up boundaries,
category grouping/order, annual/average calculations without intermediate
rounding, past/future/missing anchors, month ends, leap and century years,
Johannesburg midnight/countdowns, bounded output, >100-row totals, read guard,
account/cross-issuer isolation, rejected owner injection, and CRUD recalculation.
These tests do not prove native layout, actual reactive screen subscriptions,
live JWT signatures or reminder delivery.

### Verified on 2026-10-23

- 64 new calculation/query tests pass; all 140 Convex tests plus 10 existing
  auth/configuration tests pass with `npm run test:convex`.
- The 64-test calculation suite also passes under America/New_York host timezone.
- App and backend/test typechecks pass. Uncached lint has zero errors and two
  pre-existing clsx import warnings.
- All 61 focused UI/form/simulated-hook regressions pass; screens are unchanged.
- `npx convex dev --once --typecheck enable` successfully synchronized to personal
  development deployment flippant-dolphin-108 (radebeneo17:subhog:dev/neo-radebe).
- Public no-token HTTP query to deployed dashboard:summary returned
  UNAUTHENTICATED; no admin identity was supplied. Authenticated behavior remains
  covered by mocked account/issuer tests, not a live UI acceptance claim.
- No schema changes, new dependencies, production changes or seeded remote data.
- Review panel opened; changes remain uncommitted. Home/Insights integration and
  remaining Unit 3 device acceptance are not marked passed by these tests.
