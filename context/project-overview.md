# SubHog — Project Overview

## Overview

SubHog is a mobile subscription tracker app built with Expo (React Native) that helps users
monitor, manage, and understand their recurring subscriptions. Users sign up, add their
subscriptions with billing details, and get a clear view of their total monthly spend, upcoming
renewals, and per-category spending insights — all from a clean, warm-toned mobile UI.

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
- Delete / Cancel subscription from expanded card
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
