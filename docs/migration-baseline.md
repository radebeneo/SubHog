# Pre-Migration Baseline

Captured before moving application files or changing dependency boundaries.

## Source Snapshots

The workspace is one Git repository. The imported source repositories are retained in its history and tagged at their original source commits:

| Application | Source commit | Baseline tag | Monorepo import commit |
| --- | --- | --- | --- |
| Mobile | `43b10388a962d3b56852cde2d0c1fbc9cdf24684` | `pre-migration/mobile` | `410df8003a8c8b07e9f7917c3a427e354f85418c` |
| API | `1d86be676ec140977af131bf51caa78c1c471e6b` | `pre-migration/api` | `794063cdb2b29da5e1047ce023752b9005b7e4b4` |

Monorepo HEAD at baseline: `794063cdb2b29da5e1047ce023752b9005b7e4b4`.

## Dependency Snapshots

Both existing app lockfiles were retained and used by `npm ci`. At the time this baseline was captured, package manifests and lockfiles had not yet been changed.

| Lockfile | Bytes | SHA-256 |
| --- | ---: | --- |
| `apps/mobile/package-lock.json` | 587894 | `E16280C0700D9E12877EB1BAABBB32C1C76EABA57702C706263C34F7D1E1D130` |
| `apps/api/package-lock.json` | 110480 | `B5ECA8CCA20ED194D4D911EDABD34B826794A18777F09DCCF71CE24C611A8F51` |

## Existing Checks

Dependencies were restored from the app lockfiles with `npm ci` before running checks.

| Application | Command | Baseline result |
| --- | --- | --- |
| API | `npm run test:isolated` | 60 passed, 6 failed. Six legacy-auth tests cannot sign JWTs because `JWT_SECRET` is unset (`secretOrPrivateKey must have a value`). |
| Mobile | `npm run test:api` | 45 passed. |
| Mobile | `npm run lint` | Passed with two default `clsx` import warnings. |
| Mobile | `npm run typecheck` | Failed on three unresolved `@/global.css` imports. |
| Mobile | `npm run typecheck:api` | Passed. |
| Mobile | `npx expo export --platform web --output-dir <temp>` | Passed; output was kept outside the repository. |
| API | `npm start` | Not attempted: `apps/api/.env.development.local` and process-level `DB_URI` are absent, so the app cannot connect to its required database. |

The API startup prerequisite check also found no process-level `JWT_SECRET`. Live integrations were not run because they require credentials and external services.

## Worktree Notes

At baseline, untracked user files were present: `.env`, `.expo/`, `.gitignore`, and `expo-env.d.ts`. They were not modified. Dependency installation and the temporary mobile export did not change tracked project files.