# SubHog — Project Overview

## Overview

SubHog is a mobile subscription tracker app built with Expo (React Native) that helps users
monitor, manage, and understand their recurring subscriptions. Users sign up, add their
subscriptions with billing details, and get a clear view of their total monthly spend, upcoming
renewals, and per-category spending insights — all from a clean, warm-toned mobile UI.

## Approved backend direction (2026-10-23)

Clerk remains the sole authentication authority, including existing social login.
Convex is approved as the fresh application backend for subscriptions, preferences,
validation and calculations. This supersedes the older offline-only, no-database,
USD-only and no-OAuth assumptions below. Current creation supports ZAR and
Monthly/Yearly cycles; additional currency/cycle support requires an explicit decision.

Unit 1 establishes only the local Clerk–Convex foundation and a development
connection check. Subscription persistence is a subsequent unit. No uploads are
currently required, so Supabase Storage is deferred. There is no legacy API
provisioning, demo seeding, payment processing, provider cancellation, push/email
delivery, historical payment reporting, or full offline synchronization in this scope.
See `docs/convex-setup.md` for guided development configuration.

## Approved subscription backend — Unit 2 (2026-10-23)

The user approved ZAR, Monthly/Yearly billing, integer cents (1–9,999,999),
two-decimal rejection, trimmed 80-character name/plan/payment labels and a
254-character optional reminder email. Categories retain the existing nine choices.
Dates are calendar-only with an optional renewal anchor on or after the start date.
New records are active; lifecycle controls are deferred. Africa/Johannesburg,
anchor-preserving month-end recurrence and final-total-only half-up cent rounding
are agreed for the subsequent calculation unit.

Unit 2 builds the owned Convex subscription schema and create/list/get/update/delete
functions with tests. The user approved convex-test, Vitest and @edge-runtime/vm
as development dependencies. UI cutover follows as its own unit. See
`docs/subscription-backend.md` for the complete rules and contract.

## Approved UI connection — Unit 3 (2026-10-23)

Existing forms and Home/Subscriptions/Insights now connect to the owned Convex
subscription API. There is no local-write fallback. Fully loaded server-query
records are shared across tabs; totals stay client-side until the calculation unit.
Forms retain failed drafts, prevent duplicate pending writes, and close only after
acknowledgement. Read retries do not reset drafts. Configuration, authentication,
loading, reconnection and failures are explicit states. Real-device restart
persistence and live account isolation require acceptance evidence, not mocked tests.

## Historical in-memory implementation (superseded by Unit 3)

Clerk handles real authentication. Subscription screens start empty and share an
in-memory `SubscriptionContext`. The Home add button opens the existing modal;
new subscriptions appear immediately on Home, Subscriptions, and Monthly Insights.
Home shows active monthly spend (yearly prices divided by 12), the next renewal
date, and upcoming cards sorted by next renewal. Past renewal dates advance to
the next billing cycle for display, preserving their original monthly/yearly
anchor. Due-today and tomorrow labels use local calendar days.
The current add flow uses ZAR. No subscription API calls or backend configuration
are required, even if `EXPO_PUBLIC_API_BASE_URL` is set. Added records reset when
the provider unmounts or the app restarts; persistence remains future work.
API helpers and contract tests are retained but disconnected.

### Subscription editing and deletion (approved 2026-10-23)

- Expanded cards on the Subscriptions tab offer Edit and Delete actions.
- Edit opens a prefilled bottom sheet for name, optional plan/category, positive
  price, Monthly/Yearly billing cycle, start date, optional renewal date,
  optional payment-method label, and optional reminder email.
- Dates use explicit `YYYY-MM-DD` calendar inputs. Invalid dates, non-positive
  prices, invalid non-empty emails, and renewals before the start date block saving.
  Past renewal anchors remain allowed and continue rolling forward on Home.
- Saving updates the existing record by ID without changing its icon, color,
  currency, status, or list position. Closing without saving discards the draft.
- Delete asks for confirmation and removes only the tracked record; it does not
  cancel service or billing with the provider.
- Reminder email is stored only, may be cleared, and is never sent to analytics.
  No emails are sent or scheduled in this feature (user decision).
- All changes share the existing in-memory context and update Home and Insights.

## Goals

1. A signed-in user can add, view, and delete subscriptions in under 30 seconds each
2. The home screen shows total monthly spend and a list of upcoming renewals at a glance
3. The insights screen breaks spending down by category with visual summaries
4. Confirmed subscriptions persist in Convex; writes require verified connectivity (full offline synchronization is deferred)
5. Onboarding introduces the app value and routes new users to sign-up

## Core User Flow

1. User opens the app and sees the Onboarding screen (first launch only)
2. User taps "Get Started" → routed to Sign Up screen
3. User authenticates through Clerk (email/password or existing social login)
4. User is routed to the Home (Dashboard) tab
5. User taps the "+" button to add a new subscription via a bottom-sheet modal
6. User enters name, ZAR price, Monthly/Yearly cycle and category; the existing create flow resolves the icon and automatic calendar dates
7. After confirmed creation, the reactive server list shows the subscription on Home
8. User expands inline details; Subscriptions-tab cards offer Edit and confirmed record deletion (not provider cancellation)
9. User navigates to Subscriptions tab to see all subscriptions in full list view
10. User navigates to Insights tab to see spending breakdown by category
11. User navigates to Settings tab to manage account and preferences

## Features

### Dashboard (Home Tab)

- User avatar and name header with "Add subscription" button
- Balance card showing total monthly spend and next billing date
- Horizontally scrollable "Upcoming" row showing subscriptions renewing soonest
- Vertically scrollable "Active Subscriptions" list with inline expand/collapse
- Empty state when no subscriptions exist

### Subscription Management

- Add Subscription modal: name, ZAR price, billing cycle and category; automatic icon/start/renewal defaults
- Inline expanded card showing full subscription details
- Edit subscription details and confirm Delete from expanded Subscriptions-tab cards
- Optional reminder email persisted in Convex only; automated delivery is not implemented
- Searchable subscriptions list (Subscriptions tab), with up to 20 cards per page
  and Previous/Next controls when more matches exist; scrolling is enabled only
  when the displayed cards exceed the available space
- Standalone detail route remains a scaffold; full-screen implementation is outside Unit 3

### Insights Tab

- Spending breakdown by category (e.g. Entertainment, Productivity, Health)
- Total monthly and yearly spend summary
- Per-category cost bar or visual indicator

### Auth

- Sign Up screen (email + password)
- Sign In screen (email + password)
- Clerk session persistence and existing social-login flows

### Onboarding

- Single-screen onboarding introducing SubHog's value
- "Get Started" CTA routes to Sign Up

### Settings Tab

- Display name
- Sign out
- App version

## Scope

### In Scope

- Expo Router file-based navigation (tabs + stack)
- Owned Convex subscription storage with reactive reads and acknowledged writes; drafts remain local
- NativeWind (Tailwind CSS) styling using tokens defined in `global.css`
- Clerk sign-in/sign-up and verified Clerk–Convex authentication
- Home dashboard with balance card, upcoming renewals, and active subscription list
- Add subscription bottom-sheet modal
- Inline subscription detail expand/collapse
- Full subscriptions list tab
- Spending insights tab
- Settings tab with sign-out

### Out of Scope

- Legacy REST reconnection, Supabase Storage, application-user provisioning or demo seeding
- Provider cancellation, payment processing or automated reminder delivery
- Full offline synchronization or an application-level offline write queue
- Sharing or exporting subscription data
- Additional currencies/cycles beyond approved ZAR and Monthly/Yearly
- Backend dashboard calculations and full-screen detail implementation within Unit 3 (separate units)
- Web or tablet layout optimization
- Dark mode (light theme only in v1)

## Success Criteria

1. A signed-in user can add a subscription and see it appear on the home dashboard immediately
2. The home balance card correctly sums all active subscription costs (normalized to monthly)
3. The upcoming renewals row is sorted by nearest renewal date
4. The insights tab displays a correct per-category cost breakdown
5. The app navigates between tabs and supports persisted inline details; standalone detail implementation remains deferred
6. No TypeScript errors and no red-screen crashes on a fresh install
7. The onboarding screen only shows on first launch (or when not signed in)
8. Device acceptance proves create/edit/delete survive force-close/restart and real accounts remain isolated; automated mocked tests alone do not satisfy this criterion
