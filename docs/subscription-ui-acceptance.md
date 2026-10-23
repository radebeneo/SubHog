# Subscription UI connection — Unit 3 acceptance

## Scope and evidence

The existing forms/screens use the existing owned Convex subscription API.
No schema/backend functions, deployment settings, packages, uploads or seeded
data are changed by this unit. Calculations remain client-side; backend
calculations, standalone detail-screen implementation, reminder delivery and
full offline synchronization are separate units.

Automated tests use mocked identities, simulated hooks/backend responses, or
pure local helpers. They do not establish real JWT behavior, native rendering,
restart persistence or live account isolation. Bundle export proves packaging,
not interactive behavior. Record device/app version and actual results below.

## Local validation and runtime limitation (2026-10-23)

- App and backend/test typechecks pass.
- 76 Convex function tests and 10 auth/configuration tests pass with mocked identities.
- 17 retained local editing/calendar tests pass.
- All 41 focused form/display/icon/provider/action tests pass via
  `npx vitest run --config vitest.ui.config.mts`. Display/icon regressions exercise
  the real adapter with a stubbed bundled asset and mocked HTTP responses.
  Hook simulations do not prove actual React lifecycle behavior; adapter tests
  do not prove native image rendering.
- Uncached lint reports zero errors and two existing clsx import warnings.
- iOS bundle export succeeds at `dist/unit3-ios`; this proves packaging only.
- CM Browser reaches `http://localhost:8081/`. Its `#root` exists and the document
  is ready, but snapshots expose no visible text or controls. Screenshot attempts
  return “Tool result missing,” so the visual/runtime cause cannot be established.
  No live authenticated UI write or device restart was verified.

Acceptance requires the updated app on a real device and user-entered Clerk
authentication. Follow the checklist below and record observed results; do not
treat the blank browser or successful bundle as a passing runtime test.

## Real-device checklist (not yet verified)

Use your configured development deployment and two distinct real Clerk accounts.
Enter credentials yourself; never share keys, tokens, passwords or cookies.

1. Fully reload the updated Expo app and sign in as account A. Wait until the
   session is Convex-verified, connected and the full list has loaded.
2. Create a monthly R120 subscription and a yearly R1200 subscription through
   Home. Double-tap Create while a write is pending: expect one record, one
   success closure, disabled dismissal/editing and no optimistic record.
3. Verify both records and their IDs/details on Home, Subscriptions and Insights.
   Existing estimates should total R220 monthly. Search and expand inline details.
4. Force-close/restart the app (not just Fast Refresh). Sign in again if needed.
   Verify both server records, amounts, calendar dates and metadata return.
5. Edit a record's amount, name, category, billing cycle, dates and optional
   metadata. Wait for confirmed save, restart and confirm saved values. Reopen,
   change a draft, cancel, and reopen: canceled values must not persist.
6. Clear optional plan/category/renewal/payment label/reminder email; save,
   restart and confirm they remain cleared. Invalid dates, pre-start renewals,
   excess decimals, out-of-range amounts and invalid email must block saving.
7. Keep Subscription must make no change. Confirm Delete, wait for success,
   restart and confirm the record stays absent. Include deletion of the last
   record; complete empty lists should show explicit empty states and zero totals.
8. Sign out as A and sign in as B. A's records, drafts, pending successes and
   errors must never flash or appear under B. Create B's record, restart, then
   switch back to A: each account sees only its own records.
9. Open an unsaved form and disconnect/reconnect. Writes are disabled when
   disconnected/unverified/loading; the draft remains. If a write was already
   submitted, the Convex client may complete it after reconnect. Await its result;
   do not assume it was canceled or resubmit while pending.
10. On a failed write, confirm the form stays open with its draft and sanitized
    error. For an ambiguous failure, reconnect and inspect records before an
    explicit retry; this unit does not promise cross-retry create deduplication.
11. Exercise read failure/retry in a controlled test session: only the query
    bridge resets, not the mounted editor. Last complete records remain available
    with a notice, and complete totals return only after all pages load.
12. Exercise token refresh, same-user session replacement, account switch and
    sign-out while an icon lookup/write is delayed. No stale follow-on write,
    error, closure or creation analytics may affect the new UI session.
13. Where a real account has more than 100 records, verify successive pages load
    and full search/totals include later records. Do not seed production data to
    perform this check.

## Results

- Real-device create/restart persistence: pending.
- Real-device edit/delete/restart persistence: pending.
- Live account isolation: pending.
- Token refresh/reconnect/session replacement: pending.
- Native form layout, pending controls and error recovery: pending.

A passing simulated test is not a replacement for any pending item above.
