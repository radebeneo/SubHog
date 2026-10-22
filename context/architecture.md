# Architecture Context

## Stack

| Layer | Technology | Role |
| --- | --- | --- |
| Framework | Expo SDK 57 + React Native 0.86 | Cross-platform mobile runtime |
| Language | TypeScript 6.0 (strict) | Type-safe application code |
| Routing | Expo Router 57 | File-based navigation |
| Styling | NativeWind 5 (Tailwind CSS v4) | Design tokens and semantic classes in `global.css` |
| State | React Context + `useState` | Shared in-memory subscription demo |
| Storage | In-memory subscriptions + Clerk secure token cache | Demo data and persisted authentication session |
| Auth | Clerk Expo | Real email/password authentication |
| Analytics | Optional PostHog | Existing sanitized events and screen tracking |

## System Boundaries

- `app/(tabs)/` — Clerk-gated Home, Subscriptions, Monthly Insights, and Settings.
- `app/(auth)/` — Clerk sign-in and sign-up screens.
- `app/onboarding.tsx` — Standalone onboarding screen.
- `app/_layout.tsx` — Root Stack, font/splash loading, Clerk, and optional analytics.
- `context/SubscriptionContext.tsx` — Shared subscription list and `addSubscription`.
- `context/*.md` — Project documentation alongside the context provider.
- `constants/data.ts` — Tab definitions and unused legacy demo constants.
- `lib/subscription-summary.ts` — Pure Home spend and renewal calculations.
- `hooks/useSubscriptionSummary.ts` — Shared-state consumption and calendar refresh lifecycle for Home.
- `components/CreateSubscriptionModal.tsx` — Existing form that creates an in-memory subscription.
- `lib/api-*`, `lib/subscription-controller*`, and API contract docs — Retained integration groundwork, not imported by the active subscription screens or provider.
- `global.css` — Design tokens and semantic NativeWind classes.
- `assets/` — Images, icons, and fonts; unchanged by this restoration.

## Storage Model

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
- The subscription provider mounts inside the authenticated tab layout and unmounts on sign-out.
- Subscription creation is local demo behavior only; it does not create or modify server records.
- Edit/delete and durable storage remain outside this restoration.

## Invariants

1. Preserve design tokens and existing semantic component classes in `global.css`.
2. Use NativeWind for static UI; native-only/dynamic styles may use token-based inline styles.
3. Use Expo Router file-based navigation exclusively.
4. `SubscriptionContext` is the runtime source of truth; screens do not keep their own subscription lists.
5. Unmounting the authenticated provider clears the current in-memory demo additions.
6. TypeScript strict mode is enforced: no `any` or suppression directives.
