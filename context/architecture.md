# Architecture Context

## Stack

| Layer      | Technology                           | Role                                                                 |
| ---------- | ------------------------------------ | -------------------------------------------------------------------- |
| Framework  | Expo SDK 57 + React Native 0.86      | Cross-platform mobile runtime (iOS, Android, Web)                    |
| Language   | TypeScript 6.0 (strict)              | Type-safe application code throughout                                |
| Routing    | Expo Router 57 (file-based)          | Navigation — tabs, stack, dynamic routes                             |
| Styling    | NativeWind 5 (Tailwind CSS v4)       | Utility-first styling with design token system in `global.css`       |
| State      | React Context + external-store controller | Session-scoped subscription read state; no external state manager |
| Storage    | Optional API + Clerk secure token cache | Remote subscriptions when configured; persisted Clerk session       |
| Auth       | Clerk Expo                           | Email/password UI backed by the active Clerk session                  |
| Icons      | @expo/vector-icons (Ionicons)        | Tab bar and UI icons                                                 |
| Navigation | @react-navigation/bottom-tabs        | Tab navigator rendered by Expo Router                                |

## System Boundaries

- `app/(tabs)/` — Tab screens consume API-backed subscription state from `SubscriptionContext`; Settings remains available during API failures.
- `app/(tabs)/subscriptions/` — Nested stack for subscription detail screen (`[id].tsx`).
- `app/(auth)/` — Auth screens: sign-in, sign-up. Rendered inside a Stack navigator, no tab bar.
- `app/onboarding.tsx` — Standalone onboarding screen shown before auth.
- `app/_layout.tsx` — Root Stack layout. Controls which route group is active (auth vs tabs).
- `context/` — AI context documentation only. NOT a source code folder.
- `global.css` — Design token definitions (colors, spacing, font families). All Tailwind/NativeWind classes are defined here under `@theme` and `@layer components`.
- `assets/` — Images, icons, and splash screen assets. Read-only during normal development.

## Storage Model

- **Optional remote API**: Owns API identity associations and subscription records when `EXPO_PUBLIC_API_BASE_URL` is configured. An unset or blank URL selects a backend-unconfigured state after Clerk sign-in: existing tabs render with empty subscription data, without API calls, fabricated API identities, sample records, or local mutations. This is not persistent local subscription storage.
- Invalid configured URLs remain configuration failures. A configured backend's request failures never silently fall back to empty data.
- **Clerk secure token cache**: Persists the active authentication session; bearer credentials are not copied into application state or storage.
- **React Context (in-memory)**: Exposes session-scoped identity, provisioning, subscription-read state, and DTO display adapters.

## Auth and Access Model

- Clerk is the authentication authority and exposes the active user and session IDs.
- Authenticated API reads start only after Clerk is loaded with an active session.
- `GET /identity` resolves the API user; the Clerk subject is never used as the subscription owner ID.
- Provisioning is an explicit user action through `POST /identity/provision`.
- Subscription create, update, and delete remain outside the integrated client slice.

## Invariants

1. **No hardcoded hex values in component files.** All colors must use NativeWind classes that map to tokens defined in `global.css` (`@theme`). Components must never inline `style={{ color: '#ea7a53' }}` or similar.
2. **Global CSS component classes must be used for repeated UI patterns.** The `@layer components` block in `global.css` defines semantic class names (e.g. `sub-card`, `auth-button`). Components must use these classes, not one-off Tailwind utility chains.
3. **Expo Router file-based routing must not be bypassed.** Navigation must use `<Link>`, `router.push()`, or `router.replace()` from `expo-router` — never React Navigation's `navigate()` directly.
4. **Context is the only source of truth for subscription data at runtime.** Components must not maintain their own local copies of subscription lists.
5. **Authenticated work is session-generation scoped.** Sign-out, account changes, and same-user session replacement invalidate pending work and clear user-scoped state.
6. **TypeScript strict mode is enforced.** No `any` types, no `// @ts-ignore`, no implicit `any` in function signatures.
