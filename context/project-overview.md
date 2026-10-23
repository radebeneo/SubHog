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

## Current Implementation (2026-10-23)

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
4. The app works fully offline with local data storage (no backend required for v1)
5. Onboarding introduces the app value and routes new users to sign-up

## Core User Flow

1. User opens the app and sees the Onboarding screen (first launch only)
2. User taps "Get Started" → routed to Sign Up screen
3. User creates an account (email + password, no OAuth in v1)
4. User is routed to the Home (Dashboard) tab
5. User taps the "+" button to add a new subscription via a bottom-sheet modal
6. User fills in: name, logo/icon, price, billing cycle (monthly/yearly), category, and next renewal date
7. Subscription appears in the active list on the Home screen
8. User taps a subscription card to expand inline details (name, price, next renewal, category, cancel button)
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

- Add Subscription modal (bottom sheet): name, price, billing cycle, category, renewal date
- Inline expanded card showing full subscription details
- Edit subscription details and confirm Delete from expanded Subscriptions-tab cards
- Optional reminder email stored locally only; automated delivery is not implemented
- All subscriptions list view (Subscriptions tab)
- Dynamic route `/subscriptions/[id]` for full-screen detail view

### Insights Tab

- Spending breakdown by category (e.g. Entertainment, Productivity, Health)
- Total monthly and yearly spend summary
- Per-category cost bar or visual indicator

### Auth

- Sign Up screen (email + password)
- Sign In screen (email + password)
- Local session persistence (no OAuth in v1)

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
- Local data storage (AsyncStorage or in-memory for v1)
- NativeWind (Tailwind CSS) styling using tokens defined in `global.css`
- Auth screens (sign in / sign up) with local session state
- Home dashboard with balance card, upcoming renewals, and active subscription list
- Add subscription bottom-sheet modal
- Inline subscription detail expand/collapse
- Full subscriptions list tab
- Spending insights tab
- Settings tab with sign-out

### Out of Scope

- Backend API or database (no Supabase, Firebase, or custom server in v1)
- OAuth / social login (Google, Apple, etc.)
- Push notifications for renewal reminders
- Sharing or exporting subscription data
- Multi-currency support (USD only in v1)
- Web or tablet layout optimization
- Dark mode (light theme only in v1)

## Success Criteria

1. A signed-in user can add a subscription and see it appear on the home dashboard immediately
2. The home balance card correctly sums all active subscription costs (normalized to monthly)
3. The upcoming renewals row is sorted by nearest renewal date
4. The insights tab displays a correct per-category cost breakdown
5. The app navigates correctly between all tabs and the subscription detail route
6. No TypeScript errors and no red-screen crashes on a fresh install
7. The onboarding screen only shows on first launch (or when not signed in)
