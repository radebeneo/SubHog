# Architecture Context

## Stack

| Layer      | Technology                           | Role                                                                 |
| ---------- | ------------------------------------ | -------------------------------------------------------------------- |
| Framework  | Expo SDK 54 + React Native 0.81      | Cross-platform mobile runtime (iOS, Android, Web)                    |
| Language   | TypeScript 5.9 (strict)              | Type-safe application code throughout                                |
| Routing    | Expo Router 6 (file-based)           | Navigation — tabs, stack, dynamic routes                             |
| Styling    | NativeWind 5 (Tailwind CSS v4)       | Utility-first styling with design token system in `global.css`       |
| State      | React Context + useState (local)     | In-memory subscription and auth state; no external state manager     |
| Storage    | AsyncStorage (v1)                    | Persisting subscriptions and session locally on device               |
| Auth       | Local email/password (v1)            | Custom auth state stored in Context; no Clerk/Firebase in v1         |
| Icons      | @expo/vector-icons (Ionicons)        | Tab bar and UI icons                                                 |
| Navigation | @react-navigation/bottom-tabs        | Tab navigator rendered by Expo Router                                |

## System Boundaries

- `app/(tabs)/` — Tab screens: index (home), subscriptions, insights, settings. Each file owns its own screen layout and data fetching from context.
- `app/(tabs)/subscriptions/` — Nested stack for subscription detail screen (`[id].tsx`).
- `app/(auth)/` — Auth screens: sign-in, sign-up. Rendered inside a Stack navigator, no tab bar.
- `app/onboarding.tsx` — Standalone onboarding screen shown before auth.
- `app/_layout.tsx` — Root Stack layout. Controls which route group is active (auth vs tabs).
- `context/` — AI context documentation only. NOT a source code folder.
- `global.css` — Design token definitions (colors, spacing, font families). All Tailwind/NativeWind classes are defined here under `@theme` and `@layer components`.
- `assets/` — Images, icons, and splash screen assets. Read-only during normal development.

## Storage Model

- **AsyncStorage (local device)**: Active subscriptions list (id, name, icon, price, billingCycle, category, nextRenewal). User session (display name, email, isLoggedIn flag).
- **React Context (in-memory)**: Runtime subscription state and auth state. Seeded from AsyncStorage on app load. Source of truth for all UI rendering.
- **No remote database or file storage in v1**: All data is local-only.

## Auth and Access Model

- Every user creates an account with email + password stored locally (AsyncStorage).
- On app launch, the root layout checks whether a session exists. If not, it navigates to `onboarding` or `(auth)/sign-in`.
- Auth state is held in a `AuthContext` provider that wraps the entire app.
- No mutation (add/delete subscription) can be performed without an active local session.
- No multi-user or sharing model — all data is private to the device user.

## Invariants

1. **No hardcoded hex values in component files.** All colors must use NativeWind classes that map to tokens defined in `global.css` (`@theme`). Components must never inline `style={{ color: '#ea7a53' }}` or similar.
2. **Global CSS component classes must be used for repeated UI patterns.** The `@layer components` block in `global.css` defines semantic class names (e.g. `sub-card`, `auth-button`). Components must use these classes, not one-off Tailwind utility chains.
3. **Expo Router file-based routing must not be bypassed.** Navigation must use `<Link>`, `router.push()`, or `router.replace()` from `expo-router` — never React Navigation's `navigate()` directly.
4. **Context is the only source of truth for subscription data at runtime.** Components must not maintain their own local copies of subscription lists. All reads and writes go through the subscription context.
5. **No network calls in v1.** No `fetch()`, Axios, or SDK calls to external APIs. All data is local.
6. **TypeScript strict mode is enforced.** No `any` types, no `// @ts-ignore`, no implicit `any` in function signatures.
