# AI Workflow Rules

## Approach

Build SubHog incrementally using a spec-driven workflow. The context files in this directory
define what to build, how to build it, and the current state of progress. Always implement
against these specs — do not infer or invent behavior from scratch. When a requirement is
unclear, resolve it in the relevant context file before writing code.

## Scoping Rules

- Work on one feature unit at a time — one screen, one component, one modal per implementation step
- Prefer small, verifiable increments over large speculative changes
- Do not combine unrelated system boundaries (e.g. auth + subscription data + UI) in a single step
- Do not install packages speculatively — only install what the current unit actually requires
- Do not generate placeholder screens; every screen you build must match the design tokens in `global.css`

## When to Split Work

Split an implementation step into smaller steps if it combines:

- A UI component change AND a context/state change (split into two steps)
- More than one screen or modal in a single prompt
- Business logic (e.g. cost calculation) AND rendering (e.g. balance card UI)
- Any behavior not clearly defined in the context files

If the output cannot be verified end-to-end in a single session, the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent product behavior that is not defined in `project-overview.md` or a spec file
- If a requirement is ambiguous, add an open question to `progress-tracker.md` and stop — do not guess
- If a requirement is missing, do not implement a "reasonable default" — surface it as an open question
- If a design decision (e.g. which icon to use) is not specified, ask before implementing

## Protected Files

Do not modify the following unless explicitly instructed:

- `global.css` — Design tokens and component utility classes. Only modify to add new component classes, never remove or rename existing ones
- `app.json` — Expo configuration. Do not touch.
- `assets/` — All image and icon assets. Do not delete, rename, or move these files
- `package.json` — Only modify when explicitly installing a new package for the current unit

## Expo Version Requirement

**Always check `https://docs.expo.dev/versions/v54.0.0/` before writing any Expo-specific code.**
Expo SDK 54 has breaking changes from earlier versions. Do not rely on memory of older APIs.
Key areas to verify: `expo-router` v6 APIs, `SafeAreaView` from `react-native-safe-area-context`,
`useLocalSearchParams` types, and `expo-haptics` usage.

## Keeping Docs in Sync

Update the relevant context file whenever implementation causes a change to:

- System architecture or folder boundaries
- Storage model decisions (e.g. what gets persisted to AsyncStorage)
- New code conventions or patterns not already covered by `code-standards.md`
- Feature scope (additions or removals)

Always update `progress-tracker.md` after completing a unit.

## Before Moving to the Next Unit

1. The current unit works end-to-end within its defined scope (visible, testable result)
2. No invariant defined in `architecture.md` was violated (no hardcoded colors, no `any`, no direct nav bypasses)
3. `progress-tracker.md` has been updated to reflect the completed work
4. No TypeScript errors (`npx tsc --noEmit` passes)
5. The Expo dev server shows no red-screen errors when navigating to the affected screens
