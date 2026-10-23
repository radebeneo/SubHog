# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Clerk–Convex foundation (Unit 1)

Convex `1.48.0` is installed; Expo is aligned to the existing `57.0.31` lockfile.
Follow **[Development setup](docs/convex-setup.md)** to connect your Clerk
development instance and a fresh Convex development deployment.

Unit 1 adds the authenticated provider, an empty schema, ownership helpers and a
read-only identity query. In development, Settings includes a connection check.
It reports configuration, authentication and query states separately.
Switching Clerk accounts or sessions resets route-local state and closes the
previous Convex client. Unit 2 adds the subscription backend described below.

The legacy REST/MongoDB contract is superseded for this backend. Existing API
helpers/tests are historical and disconnected. Supabase Storage is deferred
because the current app has no upload feature.

## Subscription backend (Unit 2)

The Convex backend provides owned create, paginated list, get, update and delete
operations. It validates integer ZAR cents, Monthly/Yearly cycles, calendar dates,
approved categories and optional metadata. See
[Subscription backend rules and contract](docs/subscription-backend.md).

Run `npm run test:convex` for auth/configuration and Convex function tests.
The function tests use isolated in-memory databases and mocked identities.

## Persisted subscription UI (Unit 3)

Clerk authentication requires `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`; subscription
storage requires `EXPO_PUBLIC_CONVEX_URL` and the configured Clerk–Convex backend
from [Development setup](docs/convex-setup.md). The app does not reconnect the
legacy REST API, even if `EXPO_PUBLIC_API_BASE_URL` is set. Missing configuration
shows an explicit notice and disables writes; there is no local-write fallback.

Home, Subscriptions and Insights share the complete reactive Convex list.
Pagination fetches successive pages of 100 before publishing lists/totals as
complete. During a read retry the last complete server snapshot is retained;
forms remain mounted and totals are hidden until the complete list returns.
Home/Insights still use their existing client-side calculations. Backend Unit 4
adds `api.dashboard.summary` for integer-cent spending/category totals and
Johannesburg anchored renewals, tested independently. Connecting both screens
to this reactive query is the next separate unit. See the
[Calculation contract](docs/subscription-calculations.md), including the explicit
1000-record safety guard (larger accounts error rather than show partial totals).

Tap Home's add button to create a ZAR Monthly/Yearly subscription. On the
Subscriptions tab, expand a card and tap Edit for name, plan, approved category,
price, billing cycle, calendar-only start/renewal dates, payment-method label and
optional reminder email. Amount text is parsed directly into integer cents;
excess decimal places are rejected. Empty optional fields are cleared on save.

Create, Save and Delete await backend acknowledgement. Pending submissions
disable editing/dismissal and reject duplicate taps. Failed writes preserve
drafts with a sanitized error; read retry does not reset them. After an ambiguous
failure, reconnect and check the list before explicitly retrying. No offline
write queue or application-level automatic mutation replay is implemented.
Account/session changes clear UI snapshots/drafts and close the old Convex client.

Delete removes only the tracked record, not the provider's service or billing.
Reminder email is stored only; no emails are sent or scheduled. Do not enter
full payment-card details. The standalone detail-screen scaffold is not implemented
by this unit. Legacy API helpers and tests remain disconnected historical code.

Run focused UI/form regressions (simulated hooks/backend, no live/device claim):
`npx vitest run --config vitest.ui.config.mts`.
Run existing editing/calendar regressions:
`node --experimental-strip-types --test lib/subscription-edit.test.ts lib/subscription-summary.test.ts`.

See [UI connection acceptance](docs/subscription-ui-acceptance.md) for the
real-device restart, edit/delete, account-isolation and reconnect checklist.
Mocked ownership/write tests and bundle exports do not establish live persistence.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
