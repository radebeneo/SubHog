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
npm ci
npm run test:mobile
npm run test:api
npm run lint
npm run typecheck
```

The API's legacy password-auth tests require `JWT_SECRET` and `JWT_EXPIRES_IN`. API startup additionally requires `DB_URI`; live acceptance tests require their explicitly documented credentials and seed approval.

The original `apps/mobile/package-lock.json` and `apps/api/package-lock.json` remain preserved as source snapshots. `migration-baseline.md` records their pre-migration hashes and baseline checks.
