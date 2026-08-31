# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Foundation / Scaffolding — Setting up routing, context, and navigation structure

## Current Goal

- Implement SubscriptionContext and AuthContext providers, then build the Home dashboard screen UI

## Completed

- Expo project initialized (Expo SDK 54, React Native 0.81, Expo Router 6)
- NativeWind 5 configured with Tailwind CSS v4 (`global.css`)
- Design token system defined in `global.css` (`@theme` + `@layer components`)
- Root layout (`app/_layout.tsx`) — Stack navigator with `headerShown: false`
- Expo Router tab structure scaffolded: Home, Subscriptions, Insights, Settings
- Auth route group scaffolded: Sign In, Sign Up (`app/(auth)/`)
- Dynamic subscription detail route scaffolded: `app/(tabs)/subscriptions/[id].tsx`
- Onboarding screen scaffolded: `app/onboarding.tsx`
- All six AI context files populated for this project

## In Progress

- None

## Next Up

1. Create `types/subscription.ts` — Subscription and Category type definitions
2. Create `types/auth.ts` — User and AuthState type definitions
3. Create `context/SubscriptionContext.tsx` — Provider with add/delete/list + AsyncStorage persistence
4. Create `context/AuthContext.tsx` — Provider with sign-in/sign-up/sign-out + local session persistence
5. Update root `app/_layout.tsx` to wrap with both providers and handle auth-gating
6. Build Home screen (`app/(tabs)/index.tsx`) — header, balance card, upcoming row, active list
7. Build Add Subscription modal (`components/AddSubscriptionModal.tsx`)
8. Build Onboarding screen (`app/onboarding.tsx`)
9. Build Sign In screen (`app/(auth)/sign-in.tsx`)
10. Build Sign Up screen (`app/(auth)/sign-up.tsx`)
11. Build Subscriptions tab (`app/(tabs)/subscriptions.tsx`) — full list view
12. Build Subscription detail screen (`app/(tabs)/subscriptions/[id].tsx`)
13. Build Insights tab (`app/(tabs)/insights.tsx`) — category breakdown
14. Build Settings tab (`app/(tabs)/settings.tsx`) — profile and sign-out

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
