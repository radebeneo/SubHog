# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- EXPO-03 Session-Aware Identity and Subscription Reads

## Current Goal

- Maintain explicit Clerk session-scoped identity, provisioning, and owned-subscription read state

## Completed

- Repository migration established npm workspaces and shared contracts, API client, and domain packages; mobile routes and source moved into the authenticated route group and `src/`; API runtime moved under `src/`.
- Pre-migration source commits are retained by `pre-migration/mobile` and `pre-migration/api`; original app lockfiles and resolved dependency snapshots remain unchanged.
- Expo project initialized (Expo SDK 57, React Native 0.86, Expo Router 57)
- NativeWind 5 configured with Tailwind CSS v4 (`global.css`)
- Design token system defined in `global.css` (`@theme` + `@layer components`)
- Root layout (`app/_layout.tsx`) — Stack navigator with `headerShown: false`
- Expo Router tab structure scaffolded: Home, Subscriptions, Insights, Settings
- Auth route group scaffolded: Sign In, Sign Up (`app/(auth)/`)
- Dynamic subscription detail route scaffolded: `app/(app)/subscriptions/[id].tsx`
- Onboarding screen scaffolded: `app/onboarding.tsx`
- Onboarding splash screen implemented with the supplied pattern artwork, responsive full-screen layout, and Get Started navigation to Sign Up
- Root index route added to open onboarding on app launch
- All six AI context files populated for this project

## In Progress

- Live Clerk token-claim and public API acceptance remain deployment-environment gates

## Completed

- EXPO-01: optional PostHog config is now non-fatal in development with a concise warning instead of a thrown error
- Root app startup handles font loading and splash dismissal explicitly, with a visible failure state for actual startup errors
- Manual screen tracking remains active while automatic PostHog screen capture remains disabled via configured provider settings
- Analytics payloads have been sanitized and typed to avoid invalid optional values and unsupported payload fields
- `.env.example` documents the actual public PostHog env names alongside the required Clerk key
- Focused PostHog config validation tests pass in Node without contacting external services
- The repository-level [`CONTRACT-01`](../../../docs/contracts/CONTRACT-01.md) is the sole canonical human-readable identity and owned-subscription contract
- API client recovery coordinates concurrent reads, rejects stale or cancelled responses, limits reads to one replay, never replays mutations, and redacts observed credentials
- Reproducible API/test typechecking is available through `npm run typecheck:api`
- EXPO-03 wires Clerk's ordinary session token into the API client after auth readiness
- Subscription state distinguishes auth loading, signed out, identity resolution, unprovisioned, provisioning, list loading, ready, and operation-scoped failures
- Sign-out, account changes, and same-user session replacement invalidate pending work and clear prior user-scoped identity, subscriptions, and errors
- Provisioning is user-triggered, duplicate submissions are suppressed, and ambiguous transport failures recheck identity before any explicit resubmission
- Production subscription screens use API-backed data with loading, empty, failure, retry, and provisioning UI; local create controls are removed from integrated mode
- DTO display adaption preserves API IDs, currencies, lowercase enums, nullable renewal dates, payment methods, frequencies, and server ordering
- Insights keep amounts separated by currency and billing frequency instead of producing mixed-currency totals
- Isolated orchestration tests cover auth readiness, provisioning, stale work, contracted failures, DTO edge cases, fixture absence, and token-safe errors
- EXPO-03 closeout coverage asserts immediate session-data removal, stale resolve/reject isolation, no stale follow-on requests, unchanged-auth idempotence, and preserved transport failure classification
- INT-01B preparation strengthens sign-out coverage against stale follow-on list requests and requires the public API base URL to contain the canonical `/api/v1` path exactly once
- Clerk verifier configuration is validated before the API listener starts while remote JWKS retrieval remains lazy
- Duplicate raw `Authorization` headers are rejected and Clerk-only routes do not fall back to legacy JWT authentication
- Subscription detail, update, cancellation, and deletion routes resolve the Clerk association and use owner-scoped compound database predicates
- Subscription item responses use the shared allowlisted DTO; malformed, missing, and cross-owner item IDs are indistinguishable
- Signup validates the server-derived combined profile name against the 2-through-20-character contract
- `PROFILE_INCOMPLETE` provisioning failures expose an in-app Clerk profile-name recovery flow and explicit provisioning retry
- Repository tests, typechecks, lint, and the web export build pass; the build requires the configured Clerk publishable key as intended

## Next Up

1. Verify the ordinary Clerk session-token claim policy and live public API base URL
2. Run live end-to-end acceptance with approved Clerk credentials and the resource-bound database configuration
3. Wire mobile subscription mutation screens to the protected item endpoints when that product scope is scheduled

## Open Questions

- Should the home screen show a user avatar image or an initials placeholder when no photo exists?
- What categories should be available in the Add Subscription modal? (Suggested: Entertainment, Productivity, Health & Fitness, Finance, Education, Shopping, Utilities, Other)
- Is AsyncStorage already installed, or does it need to be added? (`@react-native-async-storage/async-storage` is not in `package.json`)

## Architecture Decisions

- NativeWind 5 (Tailwind v4) chosen for styling — all tokens live in `global.css`, not `tailwind.config.js`
- Clerk is the active authentication authority; API requests use its ordinary active-session token
- The remote API is authoritative for identity association and owned subscription reads
- Subscription mutations remain disabled in integrated mobile mode until the client workflows are implemented against the protected backend contract
- Cancellation marks a subscription as `cancelled`; deletion remains a separate explicit operation
- Expo Router 57 file-based routing — no manual navigator setup in component code
- `react-native-reanimated` (already installed) will be used for subscription card expand/collapse animation

## Session Notes

- The project name is **SubHog** (`app.json` slug: `SubHog`)
- The color theme is warm: cream background (`#fff9e3`), deep navy text (`#081126`), burnt-orange accent (`#ea7a53`)
- `global.css` is imported in `app/(app)/(tabs)/index.tsx` and `app/_layout.tsx`
- All screen files in `app/(tabs)/` are currently placeholder stubs — they need full implementation
- Expo is running in dev mode (`npx expo start`) — test changes with Expo Go on device
