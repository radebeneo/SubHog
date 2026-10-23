# Architecture Context

## Approved Clerk–Convex integration (2026-10-23)

This section supersedes earlier frontend-only and disconnected REST/MongoDB
integration assumptions. Clerk is the sole authentication authority. Convex will
own persisted subscriptions, preferences, validation, billing schedules and derived
dashboard/insight values. There is no application-user provisioning step.

Unit 1 installs `convex@1.48.0` and aligns installed Expo with the existing lockfile
(`57.0.31`). It adds a root Clerk–Convex provider, session-scoped client/UI lifetime,
an empty schema, verified-identity/ownership helpers, a read-only identity query,
and a development-only connection check in Settings. No subscription table or
mutation is introduced until the remaining financial and metadata rules are agreed.
At Unit 1 closeout, subscription interactions remained in memory; Unit 3 below supersedes that state.

- Ownership uses Convex's verified `identity.tokenIdentifier` (issuer + subject),
  never an email or an owner supplied by a client.
- Every protected function must require identity. Future ID-based reads/writes
  must check the fetched document's owner before exposing or changing it.
- Convex's configured Clerk issuer and audience `convex` govern token verification.
- The root provider covers both authenticated tabs and standalone detail routes.
  Changing Clerk user/session remounts its descendants and closes the old client.
- Unit 1 preserved the then-local flow when unconfigured. Unit 3 replaces that
  fallback with an explicit storage notice and disabled writes.
- Server data will use Convex hooks, gated on `useConvexAuth`; local state remains
  for drafts, search, and modals. No REST wrapper or additional state library.
- No uploads were found; Supabase Storage is deferred.
- Setup is development-only and user-guided. Do not use the EAS connect shortcut
  to overwrite production/preview configuration for this unit.
- See `docs/convex-setup.md` for setup and acceptance checks. Legacy API code/tests
  are retained as historical code, not contracts for this backend.

## Approved subscription backend — Unit 2

`convex/schema.ts` gains an owner-indexed subscriptions table. Public operations
in `convex/subscriptions.ts` are intended for the next unit's Convex hooks:
create, paginated list, get, full editable-field update and remove. Each operation
requires verified identity; every ID-based operation checks the document owner.
Mutations validate the complete resulting editable record atomically.

Shared pure validation and decimal-to-cents parsing live in
`lib/subscription-rules.ts`, without React Native or service dependencies, so the
future forms can reuse the same rules. Convex validators describe the stored schema
and enforce the wire contract. Only integer cents and one billingCycle are stored.
Owner, currency, active status, initial color and serializable icon are immutable
through the edit endpoint. Tests call the registered functions via convex-test.

The approved product rules, date/rounding policy, error semantics and next-unit
boundary are in `docs/subscription-backend.md`. At Unit 2 closeout the UI still
used in-memory records; Unit 3 connects it to these operations.

## Approved UI connection — Unit 3

This section supersedes the historical in-memory storage descriptions below.
Convex is the subscription source of truth; SubscriptionContext exposes reactive
server records and awaited create/update/remove actions, not local mutations.
There is no in-memory fallback when configuration or authentication fails.

- Load the complete owned list through successive native pages of at most 100,
  retaining newest-first ordering. Existing client-side search and summaries
  require all pages; do not show partial totals as complete. Backend aggregate
  calculations remain a separate unit.
- The Subscriptions screen filters the complete shared snapshot, then displays
  client-side pages of at most 20 cards. Page selection and measured list dimensions
  are local UI state; this does not change native backend pagination or summary inputs.
  Pure pagination and overflow helpers live in `lib/subscription-list.ts`.
- A small query bridge isolates thrown query errors from route children, so
  retrying reads does not unmount form drafts. Context holds only the latest
  server-query snapshot, never optimistically created or edited records.
- Protected hooks wait for useConvexAuth. Missing configuration, auth verification,
  disconnected/reconnecting, loading, and read failure are explicit UI states.
  Mutations require a verified, connected session and a fully loaded list.
- Forms parse decimal text directly into cents with the shared approved rules.
  Create retains its automatic start/next-cycle defaults as calendar dates;
  Edit retains explicit optional dates/metadata and uses the same category choices.
- Await backend acknowledgement before success/close or creation analytics.
  Disable repeated submission and dismiss/edit controls while a write is pending;
  failed writes retain the draft and expose a sanitized operation error.
- Root session-keyed lifetime clears snapshots, errors and drafts across
  user/session changes. An icon lookup finishing after unmount cannot start a write.
- No new libraries, demo seeds, backend/schema changes, email delivery, offline
  write queue, or legacy REST reconnection are part of this unit.
- The unimplemented standalone detail-route scaffold is not a new detail-screen
  feature in this unit; existing inline details consume the persisted shared list.

## Backend calculations — Unit 4 (2026-10-23)

`convex/dashboard.ts` exposes the authenticated `dashboard.summary` query for
the later Home/Insights integration. It derives ownership from tokenIdentifier,
reads only the owner's indexed records, and delegates pure integer/calendar
logic to `convex/lib/subscriptionCalculations.ts`. No schema or stored-anchor
changes, scheduled jobs, reminder delivery, or screen changes are in this unit.

- Pass an explicit epoch-millisecond `now` argument; queries must not read the
  wall clock. The backend converts it to Africa/Johannesburg's modern UTC+02:00
  calendar (timestamps from 1970 through the representable year 9999).
  Later hooks must refresh the argument on Johannesburg midnight/focus/resume.
- Accumulate monthly amounts as integer twelfths of a cent: monthly cents × 12,
  yearly cents unchanged. Round only completed totals, half-up. Annual estimate
  is monthly cents × 12 plus yearly cents, not rounded monthly spend × 12.
  Average uses the unrounded total. Missing categories join Other; categories
  sort by exact monthly-equivalent spend, with existing category order for ties.
- Missing renewal anchors stay unknown. Due-today remains due today all day.
  Past anchors advance directly from the original date, clamping month ends
  without drift. Dates/countdowns are calendar-only and never depend on host TZ.
  Occurrences beyond year 9999 cannot be represented and return null.
- A technical read guard takes at most 1001 owner records and rejects accounts
  above 1000 with SUMMARY_LIMIT_EXCEEDED instead of returning partial totals.
  This does not limit CRUD or pagination. A larger-scale aggregate component
  requires a separate approved dependency/backfill unit.
- Upcoming output defaults to 20 rows (caller-selectable 1–100); next renewal is
  computed before limiting, and hasMoreUpcoming explicitly identifies truncation.
  Equal dates preserve owner-index creation order. Return display fields only,
  never owner identifiers, payment labels or reminder email.
- Home/Insights remain on their current client calculations until Unit 5.
  Local convex-test results, development sync and device acceptance are distinct.

## Stack

| Layer | Technology | Role |
| --- | --- | --- |
| Framework | Expo SDK 57 + React Native 0.86 | Cross-platform mobile runtime |
| Language | TypeScript 6.0 (strict) | Type-safe application code |
| Routing | Expo Router 57 | File-based navigation |
| Styling | NativeWind 5 (Tailwind CSS v4) | Design tokens and semantic classes in `global.css` |
| State | Convex hooks + React Context + `useState` | Reactive server snapshot; local drafts and UI selections |
| Storage | Convex + Clerk secure token cache | Owned subscriptions and persisted authentication session |
| Auth | Clerk Expo | Real email/password authentication |
| Analytics | Optional PostHog | Existing sanitized events and screen tracking |

## System Boundaries

- `app/(tabs)/` — Clerk-gated Home, Subscriptions, Monthly Insights, and Settings.
- `app/(auth)/` — Clerk sign-in and sign-up screens.
- `app/onboarding.tsx` — Standalone onboarding screen.
- `app/_layout.tsx` — Root Stack, font/splash loading, Clerk, and optional analytics.
- `context/SubscriptionContext.tsx` — Shared subscription list and add/update/delete actions.
- `components/EditSubscriptionModal.tsx` and `components/DeleteSubscriptionModal.tsx` —
  Local draft editor and explicit record-removal confirmation.
- `context/*.md` — Project documentation alongside the context provider.
- `constants/data.ts` — Tab definitions and unused legacy demo constants.
- `lib/subscription-summary.ts` — Pure Home spend and renewal calculations.
- `hooks/useSubscriptionSummary.ts` — Shared-state consumption and calendar refresh lifecycle for Home.
- `components/CreateSubscriptionModal.tsx` — Validated local draft with awaited Convex creation.
- `lib/subscription-form.ts` — Shared form parsing and calendar-only persisted-record drafts.
- `lib/convex-subscription-display.ts` — Server document to existing UI-record adaptation.
- `hooks/useSubscriptionAction.ts` — Mounted-lifetime submission and dismissal lock.
- `lib/api-*`, `lib/subscription-controller*`, and API contract docs — Retained integration groundwork, not imported by the active subscription screens or provider.
- `global.css` — Design tokens and semantic NativeWind classes.
- `assets/` — Images, icons, and fonts; unchanged by this restoration.

## Historical in-memory storage model (superseded by Unit 3)

- The provider initializes with an empty subscription list; only user-added records appear.
- New records are prepended using a functional state update and shared across tabs.
- There is no subscription persistence or database. Records reset on provider unmount or app restart.
- Home monthly spend and Upcoming derive from active records in the shared subscription list through `lib/subscription-summary.ts`. Yearly costs are divided by 12; the current local flow uses ZAR.
- Upcoming includes active records with valid renewal dates, sorted by their next occurrence. Past dates advance by whole billing cycles anchored to the original date (including month-end/leap-year clamping), without mutating stored records. Calendar-day countdowns refresh at midnight and when the app becomes active.
- Monthly Insights derives its totals and category breakdown from the same shared subscription list.
- `EXPO_PUBLIC_API_BASE_URL` is not read by the active app. No API client, identity provisioning, or subscription request is started.
- Clerk's secure token cache continues to persist authentication; credentials are never copied into subscription state.

## Auth and Access Model

- Clerk remains the authentication authority; signed-out users are redirected by the tab layout.
- The root session-keyed Clerk–Convex client covers navigation; SubscriptionProvider
  mounts inside authenticated tabs. Account/session changes remount descendants,
  clearing snapshots and drafts without deleting persisted server records.
- Convex verifies identity before protected reads and writes. Client write gating
  is UX protection, not authorization: backend functions enforce document ownership.
- Create, full editable-field update and confirmed removal await Convex mutations.
  `types/subscription-record.ts` and `lib/subscription-rules.ts` define the contract.
  Legacy local editing/state helpers remain for historical regression coverage only.
- The Subscriptions tab selects by ID. Drafts mount fresh for each edit session;
  read retries retain them, and cancellation never changes server data.
- Optional reminder email and payment-method labels persist as metadata only.
  No payment credentials are requested, no reminder delivery is enabled, and
  reminder email/payment data must not be included in analytics.
- Real-device persistence and live account isolation still require acceptance;
  mocked ownership tests do not establish live JWT/session behavior.

## Invariants

1. Preserve design tokens and existing semantic component classes in `global.css`.
2. Use NativeWind for static UI; native-only/dynamic styles may use token-based inline styles.
3. Use Expo Router file-based navigation exclusively.
4. Convex is the source of truth; screens consume the shared complete snapshot from `SubscriptionContext`, not their own lists.
5. Unmounting the authenticated provider clears local snapshots/drafts, not confirmed Convex records.
6. TypeScript strict mode is enforced: no `any` or suppression directives.
