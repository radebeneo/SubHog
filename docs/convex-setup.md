# Clerk–Convex development setup — Unit 1

## What this unit does

- Installs the approved `convex@1.48.0`; installed Expo matches the existing
  `57.0.31` lockfile. Existing Clerk, React Native and NativeWind versions are retained.
- Mounts `AppBackendProvider` inside Clerk and around the root navigator, covering
  tabs and `/subscriptions/[id]`. Clerk's existing secure token cache is retained.
- Gives each Clerk user/session a fresh client and route tree, closes the previous
  client, and resets local records/drafts when the session changes.
- Adds an empty schema and read-only `identity:current` query. It returns only the
  verified subject and issuer. There are no mutations, user provisioning or seeds.
- Adds a development-only Settings connection check, gated on `useConvexAuth()`,
  with distinct configuration, auth, query-loading, success and error states.

Subscriptions are still in memory. Connecting Convex does not persist them yet.
The original Clerk sign-in, sign-up, social-auth and sign-out flows are retained.
The legacy REST/MongoDB contract in `docs/contracts/CONTRACT-01.md` is historical
and must not be used to design this backend. No upload feature exists, so
Supabase Storage is deferred.

## 1. Activate the existing Clerk development instance

1. Open the [Clerk dashboard](https://dashboard.clerk.com).
2. Select SubHog's existing application and its **Development** instance.
3. Activate the [Convex integration](https://dashboard.clerk.com/apps/setup/convex)
   for that instance.
4. Copy its **Frontend API URL**, such as
   `https://your-instance.clerk.accounts.dev`. This is the issuer URL.
5. Make sure the local `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` belongs to that same
   instance (`pk_test_...`). Keep the actual value in ignored `.env` or `.env.local`.
   Do not replace a working value with the example placeholder.
6. Sign out and sign back in after activation so the session uses the new claims.

The installed Convex Clerk provider requests an ordinary token when the session
audience is `convex`; otherwise it requests the `convex` JWT template. Use the
current integration activation flow above. Do not build a token exchange or install
another Clerk SDK. Neither a Clerk secret key nor a webhook is needed for Unit 1.

## 2. Create/select a fresh Convex development project

In a terminal at the repository root, run:

```sh
npx convex dev --configure new --dev-deployment cloud
```

Log in yourself when prompted. Select your intended team, a project name such as
`subhog-dev`, and the appropriate region. Use the free development setup; stop if
a prompt requires a paid plan. If you already created a fresh project in the
dashboard, use `--configure existing` instead of `--configure new`.

The command configures a development deployment and writes local configuration
to ignored `.env.local`. It also tries to sync the backend. On first setup it can
stop with **Set CLERK_JWT_ISSUER_DOMAIN...**; this is expected until step 3.
Keep note of the exact development deployment selected by the CLI.

Do not select an old subscription database for this empty schema. Do not run
`npx convex deploy` or pass a production deploy key.

### Why not the EAS integration shortcut?

The Expo guide's `eas integrations:convex:connect` command creates remote resources,
installs a package, writes a deploy key locally, and sets the public Convex URL
for development, preview **and production** in EAS. This unit uses the manual
development path so those environments can be configured independently later.
No global EAS installation or EAS configuration change is needed now.

## 3. Configure the Convex development issuer

In the [Convex dashboard](https://dashboard.convex.dev):

1. Open the project and the exact **development deployment** from step 2.
2. Open Settings → Environment Variables.
3. Set `CLERK_JWT_ISSUER_DOMAIN` to the exact Clerk Frontend API URL from step 1.
   Include `https://`; use the issuer as provided by Clerk.
4. Run `npx convex dev` again (or let the running command retry).

`convex/auth.config.ts` requires this value and sets `applicationID: "convex"`.
Convex verifies the token before exposing `ctx.auth.getUserIdentity()`.
An absent issuer must be fixed; do not remove authentication to make syncing pass.

Wait for successful function/schema synchronization. This also regenerates typed
files in `convex/_generated/`. Keep those generated files in version control.

## 4. Configure Expo's public development URL

Find the development deployment's **Deployment URL** in Convex. Add it to ignored
`.env.local`, preserving the CLI-generated `CONVEX_DEPLOYMENT`:

```dotenv
EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

Use `.convex.cloud`, not the `.convex.site` HTTP-actions URL or dashboard URL.
The client accepts hosted HTTPS deployment origins, including regional URLs such as
`https://your-deployment.eu-west-1.convex.cloud`. Copy the complete URL supplied by
Convex, retaining its region. Do not copy the illustrative URL literally.

The app needs only the public deployment URL and Clerk publishable key. Keep
`CONVEX_DEPLOY_KEY`, Clerk secret keys and tokens out of `EXPO_PUBLIC_*`, app.json,
source files, analytics and chat. The issuer is configured on Convex, not as an
Expo public variable. No deploy key is needed for ordinary mobile app requests.

Restart Expo so it picks up the new public value:

```sh
npx expo start --clear
```

Use the project's existing compatible development build/device workflow. Keep
`npx convex dev` running in a separate terminal while developing.

For future EAS development builds, set the matching public URL and Clerk
development publishable key in the **development** environment only.
`eas.json` already separates development, preview and production. Configure
preview/production with their own intended deployments and Clerk instances only
in a separately approved release task.

## 5. Verify the connection on a device

1. Sign in through the existing Clerk screen.
2. Open Settings in a development build. Under **Backend connection (development)**,
   expect **Connected. Convex verified your current Clerk account.**
3. Switch tabs; add/edit/delete a local record and confirm the existing UI works.
4. Sign out; verify tabs and `/subscriptions/[id]` redirect to sign-in.
5. Sign in as account B. A's records, open editor, search and connection state
   must be gone. Repeat with replacement of A's session without changing user ID
   if your Clerk development setup supports it.
6. Verify email/password sign-in, sign-up verification, existing social-auth flow,
   cancel/back navigation and persisted Clerk session after restart.
7. Turn connectivity off/on while checking identity: after the SDK detects socket
   disconnection, the check shows a connection-lost message instead of the cached
   identity success. Detection is not instantaneous. SDK reconnect/refresh handles
   transport recovery. A function error shows a bounded Retry check action;
   sign-out remains available.
8. Inspect Convex data: the identity check creates no users or subscriptions.

A blank public URL shows **Not configured** and retains the local flow. A malformed
URL shows a configuration error. Correct the value and restart Expo.
If authentication fails, check the development issuer, integration activation,
audience and successful backend sync, then sign out/in. A persistent authentication
wait can also indicate an unreachable deployment or offline device.
The connection check is hidden in production builds.

### Security acceptance still requiring a development deployment

- Call `identity:current` without a token using the public Convex HTTP client:
  expect `UNAUTHENTICATED`. A dashboard admin identity is not proof of public
  authentication.
- With real Clerk sessions for A and B, verify the response subject matches the
  current Clerk user; no client-supplied identity/owner argument is accepted.
- Test genuinely invalid signatures, expired tokens, wrong issuers and wrong
  audiences with a controlled development test client. They must never yield
  authenticated identity. Do not paste tokens into chat, logs or command history.
- Verify token refresh and session switching on a device. Mocking an identity
  context cannot prove the platform's JWT verification.
- Document authorized ID-based subscription tests with the first subscription
  functions; Unit 1 has no subscription endpoint or table to exercise.

## Local checks

```sh
npm run typecheck
npm run typecheck:convex
npm run test:convex
npm run lint -- --no-cache
```

`test:convex` exercises signed-out rejection, owned/missing/foreign documents,
cross-issuer ownership isolation and configuration validation with local fixtures.
It does not verify JWTs, deployed functions, persistence or device behavior.

After development setup, use normal `npx convex codegen --typecheck enable` or
`npx convex dev` to regenerate bindings. Before any deployment was configured,
Unit 1 bootstrapped bindings using the installed 1.48.0 CLI's internal local-only
`codegen --system-udfs --init` path. After explicitly enabling the already-installed
Node types in `convex/tsconfig.json` for TypeScript 6, generation and typechecking
passed with `codegen --system-udfs --typecheck enable`. This invokes the package's
generator without a deployment; it is not a deployment/authentication test and
should not become the ordinary workflow. Do not hand-edit `_generated` files.

## Next approved unit

Agree amount/text limits, integer minor-unit conversion and decimal rejection,
rounding, date/recurrence/timezone policy, categories, status transitions/reactivation
and actual preference fields. Then implement typed authorized subscription
operations, including update/delete, before cutting the shared UI over to server
data. Every protected function must derive ownership from verified
`identity.tokenIdentifier` and check ownership on ID-based access. Store serializable
icon references, never React Native asset handles.
