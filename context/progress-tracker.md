# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Startup and Optional Analytics Stabilization — handling optional PostHog config, startup failure states, and typed analytics payloads

## Current Goal

- Validate startup reliability and analytics safety without breaking Clerk-required auth bootstrap

## Completed

- Expo project initialized (Expo SDK 54, React Native 0.81, Expo Router 6)
- NativeWind 5 configured with Tailwind CSS v4 (`global.css`)
- Design token system defined in `global.css` (`@theme` + `@layer components`)
- Root layout (`app/_layout.tsx`) — Stack navigator with `headerShown: false`
- Expo Router tab structure scaffolded: Home, Subscriptions, Insights, Settings
- Auth route group scaffolded: Sign In, Sign Up (`app/(auth)/`)
- Dynamic subscription detail route scaffolded: `app/(tabs)/subscriptions/[id].tsx`
- Onboarding screen scaffolded: `app/onboarding.tsx`
- Onboarding splash screen implemented with the supplied pattern artwork, responsive full-screen layout, and Get Started navigation to Sign Up
- Root index route added to open onboarding on app launch
- All six AI context files populated for this project

## In Progress

- None

## Completed

- EXPO-01: optional PostHog config is now non-fatal in development with a concise warning instead of a thrown error
- Root app startup handles font loading and splash dismissal explicitly, with a visible failure state for actual startup errors
- Manual screen tracking remains active while automatic PostHog screen capture remains disabled via configured provider settings
- Analytics payloads have been sanitized and typed to avoid invalid optional values and unsupported payload fields
- `.env.example` documents the actual public PostHog env names alongside the required Clerk key
- Focused PostHog config validation tests pass in Node without contacting external services
- CONTRACT-01 revision 2.1 client DTO validation is aligned for the owned subscription list
- API client recovery coordinates concurrent reads, rejects stale or cancelled responses, limits reads to one replay, never replays mutations, and redacts observed credentials
- Reproducible API/test typechecking is available through `npm run typecheck:api`

## Next Up

1. Create `types/subscription.ts` — Subscription and Category type definitions
2. Create `types/auth.ts` — User and AuthState type definitions
3. Create `context/SubscriptionContext.tsx` — Provider with add/delete/list + AsyncStorage persistence
4. Create `context/AuthContext.tsx` — Provider with sign-in/sign-up/sign-out + local session persistence
5. Update root `app/_layout.tsx` to wrap with both providers and handle auth-gating
6. Build Home screen (`app/(tabs)/index.tsx`) — header, balance card, upcoming row, active list
7. Build Add Subscription modal (`components/AddSubscriptionModal.tsx`)
8. Build Sign In screen (`app/(auth)/sign-in.tsx`)
9. Build Sign Up screen (`app/(auth)/sign-up.tsx`)
10. Build Subscriptions tab (`app/(tabs)/subscriptions.tsx`) — full list view
11. Build Subscription detail screen (`app/(tabs)/subscriptions/[id].tsx`)
12. Build Insights tab (`app/(tabs)/insights.tsx`) — category breakdown
13. Build Settings tab (`app/(tabs)/settings.tsx`) — profile and sign-out

## Open Questions

- What font family is used for `--font-sans`? The CSS token is set but no font loading code was found in `app/_layout.tsx`. The font must be loaded with `expo-font` before it can be used.
- Should the home screen show a user avatar image or an initials placeholder when no photo exists?
- What categories should be available in the Add Subscription modal? (Suggested: Entertainment, Productivity, Health & Fitness, Finance, Education, Shopping, Utilities, Other)
- Should "Cancel Subscription" in the expanded card actually delete the record, or mark it as cancelled with a different visual state?
- Is AsyncStorage already installed, or does it need to be added? (`@react-native-async-storage/async-storage` is not in `package.json`)

## Architecture Decisions

- NativeWind 5 (Tailwind v4) chosen for styling — all tokens live in `global.css`, not `tailwind.config.js`
- No external auth provider (Clerk, Firebase) in v1 — local session managed in `AuthContext`
- No backend in v1 — all subscription data stored locally via AsyncStorage
- Expo Router 6 file-based routing — no manual navigator setup in component code
- `react-native-reanimated` (already installed) will be used for subscription card expand/collapse animation

## Session Notes

- The project name is **SubHog** (`app.json` slug: `SubHog`)
- The color theme is warm: cream background (`#fff9e3`), deep navy text (`#081126`), burnt-orange accent (`#ea7a53`)
- `global.css` is imported in `app/(tabs)/index.tsx` — confirm it is also imported in `app/_layout.tsx` (it currently is)
- All screen files in `app/(tabs)/` are currently placeholder stubs — they need full implementation
- Expo is running in dev mode (`npx expo start`) — test changes with Expo Go on device
