# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Clerk–Convex Unit 1: approved local authentication foundation and guided development setup.

### Clerk–Convex Unit 1 (2026-10-23)

- User approved `convex@1.48.0` and alignment to already-locked Expo `57.0.31`.
- User selected guided development setup and subsequently reported successful
  `npx convex dev` synchronization against development deployment
  `radebeneo17:subhog:dev/neo-radebe` at
  `https://flippant-dolphin-108.eu-west-1.convex.cloud`.
- Found and reproduced a client configuration bug rejecting regional deployment
  hosts. Updated URL validation to accept one optional region label and added
  regression cases while retaining HTTPS, origin-only and credential checks.
  The regional regression now passes; all 10 auth/configuration tests, app and
  backend/test typechecks, and uncached lint pass (zero errors, two existing
  clsx import warnings). Live Clerk identity acceptance is pending in Settings.
- Implemented the root Clerk–Convex provider with session-keyed route/client
  lifetime and deferred cleanup that tolerates Strict Mode effect replay.
  Navigation mounts synchronously for existing Clerk completion callbacks.
- Added an empty schema, required Clerk issuer/audience configuration, verified
  identity/ownership helpers and the read-only `identity:current` query.
- Added development-only Settings diagnostics for configuration, socket connection,
  authentication/refresh, query loading, identity mismatch, success and error/retry.
- Before development configuration, bootstrapped Convex bindings locally with the
  installed CLI's internal `--system-udfs` path. Use normal codegen or `convex dev`
  now that the user has configured a development target.
- Added development setup/acceptance instructions in `docs/convex-setup.md`,
  including regional URLs, updated the public environment example and marked
  the old contract historical.
- Earlier verification passed 17 subscription editing/calendar regression tests
  and the iOS production bundle export after lifecycle refinement:
  `npx expo export --platform ios --max-workers 2 --output-dir dist/unit1-ios`.
  Local Unit 1 implementation and the regional URL fix are ready; checking the
  signed-in development build is the next user-guided step.
- Browser navigation reached `/sign-in`, but the snapshot was empty and showing
  the browser panel timed out. Metro logged an error at the unchanged
  `SocialAuthButtons.tsx:109` SVG; its runtime cause is not confirmed.
  Browser and device acceptance are not claimed. The review panel opened.
- The assistant has not changed remote resources or dashboard settings.
  The user reported successful development synchronization; live JWT verification,
  token refresh and account/session switching still require acceptance testing.
- Unrelated untracked `assets/images/desktop.ini` and `empty-state.png` appeared
  during implementation and were left untouched.
- Empty schema avoids inventing unapproved financial/preference rules.
- Subsequent units require amount/text limits, excess-decimal and rounding policy,
  recurrence/timezone policy, categories, status/reactivation, and preference fields.
- Prepare authorized create/list/update/delete before the shared data-source cutover.
- This phase supersedes the older local-storage and REST reconnection roadmap below.

### Edit/delete (2026-10-23)

- User approved optional reminder email storage only; no email delivery or backend integration.
- Defined scope in project overview and architecture before implementation.
- Added typed editable fields, validated calendar-date drafts, and immutable
  ID-based context update/delete functions using functional state updates.
- Added prefilled edit bottom sheet with optional email/payment label and
  validation; added explicit cross-platform delete confirmation.
- Subscriptions-tab cards expose Edit/Delete. Header-only expansion avoids nested
  action propagation; details show plan and reminder email.
- Focused draft/state/derived-summary regression tests: 17 pass.
- Validation: app typecheck and standalone strict TypeScript checks for both
  editing/calendar test files pass; 17 editing/calendar tests pass, including
  America/New_York timezone coverage; all 47 retained API tests pass.
- Lint passes with zero errors and two pre-existing clsx import warnings.
  iOS production export succeeds with two Metro workers; git diff --check passes.
- CM Browser navigation/snapshot and review panel were unavailable, so interactive
  device acceptance is not claimed. Manual test: add a subscription, open
  Subscriptions, expand/Edit, save each field, verify Home/Insights, reopen and
  Cancel a draft, clear optional email/renewal, test invalid input, then test
  Keep Subscription and confirmed Delete (including deleting the last record).
- Unrelated asset deletions appeared during this session; left untouched.
- Data remains in memory and resets on sign-out/restart.

## Current Goal

- Complete Unit 1's local Clerk–Convex foundation and guide development configuration.
- Verify the deployed identity query and session isolation after a development target is selected.
- Keep subscriptions in memory until authorized CRUD and financial rules are ready.
- Reminder email remains storage-only metadata; delivery is outside this scope.

### Dynamic Home (2026-10-23)

- Added pure summary and anchored monthly/yearly recurrence helpers with focused calendar-edge tests.
- SubscriptionContext now starts empty; Home reads live monthly spend, next renewal and sorted Upcoming cards from the shared list.
- Added an actionable empty state and corrected tomorrow's countdown label; Upcoming cards accommodate real billing amounts and longer countdowns.
- Added a focused hook to refresh calendar calculations on Home focus, app resume and midnight; no subscription records are mutated.
- Validation: all 8 calendar tests pass, including a run in America/New_York for daylight-saving coverage; app typecheck passes; lint has zero errors and two pre-existing clsx import warnings; iOS production export passes with two Metro workers; git diff --check passes.
- CM Browser navigation and subsequent snapshot returned unavailable, so interactive/device acceptance is not claimed. Expo dev server was started on port 8081 for manual verification.
- Persistence and edit/delete remain separate future features.

## Completed

- Expo project initialized (Expo SDK 57, React Native 0.86, Expo Router 57)
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

- Manual device acceptance: reload Expo, sign in, verify empty Home with R0.00 monthly spend and no next renewal; add monthly R120 and yearly R1200 subscriptions, confirm R220.00 monthly spend and sorted Upcoming cards with full billing prices; expand cards, check Subscriptions/Insights, and sign out.
- Convex development setup and live authentication acceptance are next.
  Subscription persistence will use Convex in a subsequent approved unit.
  Edit/delete is implemented locally; reminder delivery is outside current scope.

## Completed

- EXPO-01: optional PostHog config is now non-fatal in development with a concise warning instead of a thrown error
- Root app startup handles font loading and splash dismissal explicitly, with a visible failure state for actual startup errors
- Manual screen tracking remains active while automatic PostHog screen capture remains disabled via configured provider settings
- Analytics payloads have been sanitized and typed to avoid invalid optional values and unsupported payload fields
- `.env.example` documents the actual public PostHog env names alongside the required Clerk key
- Focused PostHog config validation tests pass in Node without contacting external services
- CONTRACT-01 revision 2.2 is synchronized from the owner-approved API repository copy
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

### Backend-Unconfigured Startup Fix (2026-10-22)

- An unset or blank `EXPO_PUBLIC_API_BASE_URL` no longer blocks signed-in tabs. The provider does not create an API client in this mode.
- The controller exposes `backend-unconfigured` only after Clerk sign-in, without fabricated API identity or subscription data; retry/provision are no-ops.
- Home, Subscriptions, and Insights retain their layouts with empty data and a shared backend-not-connected notice. No local persistence or subscription mutations were added.
- Configured URLs still undergo strict validation; actual backend failures keep their existing error/retry behavior.
- `.env.example`, README, architecture, and project overview distinguish this limited no-backend mode from future local-storage goals.
- Added a CSS module declaration for TypeScript 6 side-effect imports without modifying the generated NativeWind declarations.
- Validation: all 47 API/config/controller tests pass; app and API typechecks pass; lint has no errors and the two pre-existing `clsx` import warnings.
- Initial iOS export timed out after Metro startup; the retry with two workers completed successfully. Bundle validation passed; no device runtime acceptance is claimed.

### Subscription Provider Render-Loop Fix (2026-10-22)

- Fixed the maximum-update-depth loop: Clerk Expo creates a new `getToken` wrapper on every render, which previously recreated the subscription controller through `useMemo([getToken])`.
- The provider now uses a lazy state initializer for stable setup and updates a token-getter ref in an effect before auth synchronization. API calls use the latest committed getter without restarting the controller.
- Existing auth/session invalidation, backend-unconfigured behavior, configuration failures, retry, and provisioning remain unchanged. No dependencies or UI changes were added.
- Validation: all 47 API/config/controller tests pass; `npm run typecheck` and `npm run typecheck:api` pass; lint reports no errors and the two pre-existing `clsx` import warnings.
- Manual device acceptance remains pending: fully reload Expo, sign in with no API URL, navigate the tabs, and verify Settings/sign-out without the update-depth error.

### Frontend-Only Restoration (2026-10-22)

- Restored the original sample records, demo Balance and Upcoming values from the frontend before API integration.
- Replaced the active API-backed subscription provider with typed React Context and in-memory additions.
- Restored the Home add button and existing modal, searchable subscription list, and Monthly Insights totals/category breakdown.
- Removed backend notice and API state-view components and all subscription-screen API gating, including Read only / Not connected labels.
- Kept Expo 57, real Clerk authentication, startup fixes, sanitized analytics, API helpers, and existing contract tests. No dependencies, assets, or design tokens changed.
- Updated README, environment example, architecture, and overview to explicitly describe the non-persistent demo and disconnected API groundwork.
- Validation: app/API typechecks pass; all 47 retained API/config/controller tests pass; lint has zero errors and the two pre-existing clsx import warnings; iOS export succeeds with two Metro workers; git diff --check passes.
- Source verification finds no backend notices, API gating, or API imports in app routes. Device runtime acceptance is not claimed; the CM review panel was unavailable.

## Next Up

1. Follow `docs/convex-setup.md` to activate Clerk's development integration and select a fresh Convex development deployment.
2. Complete live identity/JWT rejection and device/session-isolation acceptance.
3. Resolve billing, amount, metadata and preference rules before the next approved unit.
4. Implement owned subscription CRUD before switching shared screens to Convex hooks.

## Open Questions

- What font family is used for `--font-sans`? The CSS token is set but no font loading code was found in `app/_layout.tsx`. The font must be loaded with `expo-font` before it can be used.
- Should the home screen show a user avatar image or an initials placeholder when no photo exists?
- What categories should be available in the Add Subscription modal? (Suggested: Entertainment, Productivity, Health & Fitness, Finance, Education, Shopping, Utilities, Other)
- Resolved (2026-10-23): explicit Delete removes the tracked record after
  confirmation; provider cancellation is not part of this feature.
- Is AsyncStorage already installed, or does it need to be added? (`@react-native-async-storage/async-storage` is not in `package.json`)

## Architecture Decisions

- NativeWind 5 (Tailwind v4) chosen for styling — all tokens live in `global.css`, not `tailwind.config.js`
- Clerk remains the active authentication authority; the restored subscription demo makes no API requests.
- SubscriptionContext is the in-memory source of truth, initialized empty (user decision, 2026-10-23).
- Home derives active monthly spend and next billing occurrences from that list; recurrence preserves the original renewal anchor.
- Additions and edits are local only and reset on unmount/restart; durable
  persistence remains future work.
- Delete removes tracked records after confirmation, not provider billing.
- Reminder email is optional local metadata only; no emails or analytics payloads
  containing this address are sent.
- Expo Router 57 file-based routing — no manual navigator setup in component code
- `react-native-reanimated` (already installed) will be used for subscription card expand/collapse animation

## Session Notes

- The project name is **SubHog** (`app.json` slug: `SubHog`)
- The color theme is warm: cream background (`#fff9e3`), deep navy text (`#081126`), burnt-orange accent (`#ea7a53`)
- `global.css` is imported in `app/(tabs)/index.tsx` — confirm it is also imported in `app/_layout.tsx` (it currently is)
- Home, Subscriptions, and Monthly Insights use the restored frontend demo; Settings retains real Clerk sign-out.
- Expo is running in dev mode (`npx expo start`) — test changes with Expo Go on device
