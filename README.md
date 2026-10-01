# SubHog

SubHog is an npm-workspaces monorepo containing the Expo mobile app, the Node.js API, and shared contracts, client, and domain packages. The original mobile and API histories are preserved by the `pre-migration/mobile` and `pre-migration/api` Git tags.

## Workspaces

- `apps/mobile` — Expo Router application. Routes live in `app/`; application code lives in `src/`.
- `apps/api` — Express API. Runtime code lives in `src/`, tests in `tests/`.
- `packages/contracts` — Shared DTOs, enum definitions, error codes, and runtime request/response guards.
- `packages/api-client` — Platform-neutral HTTP client with injected token retrieval, cancellation, timeouts, bounded auth recovery, response validation, and safe errors.
- `packages/domain` — Platform-neutral money predicates, recurring amount grouping, renewal ordering, and calendar recurrence.

## Dependency Boundary

```text
Mobile ──→ API client ──→ Contracts
	└───────────────────→ Domain

API ───────────────────→ Contracts
	└───────────────────→ Domain
```

The mobile app imports no API implementation code. Network access remains the boundary between mobile and API. The API client does not depend on React Native or Clerk; authentication is supplied through its token getter.

## Install and Verify

Install from the repository root so npm uses the root workspace lockfile:

```sh
nvm use
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Node 24.11 and npm 11.6 are pinned by `.nvmrc`, `engines`, and `packageManager`. The root `package-lock.json` is the only lockfile; always install from the repository root.

The default `npm test` command runs unit tests only. MongoDB and live Clerk/API acceptance remain opt-in through `npm run test:integration:mongodb` and `npm run test:integration:clerk-api`. The API's legacy password-auth unit tests require `JWT_SECRET` and `JWT_EXPIRES_IN`; API startup additionally requires `DB_URI`.

Expo and EAS configuration lives in `apps/mobile`. Run EAS commands from that directory. Expo's default `expo/metro-config` workspace support is used without legacy resolver overrides, and the API client is compiled during the EAS post-install hook before bundling.
