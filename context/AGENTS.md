## SubHog — Application Building Context

Read the following files in order before implementing or making any architectural decision:

1. `context/project-overview.md` — product definition, goals, features, and scope
2. `context/architecture.md` — system structure, boundaries, storage model, and invariants
3. `context/ui-context.md` — theme, colors, typography, and component conventions
4. `context/code-standards.md` — implementation rules and conventions
5. `context/ai-workflow-rules.md` — development workflow, scoping rules, and delivery approach
6. `context/progress-tracker.md` — current phase, completed work, open questions, and next steps

Update `context/progress-tracker.md` after each meaningful implementation change.

If implementation changes the architecture, scope, or standards documented in the context
files, update the relevant file before continuing.

---

## Expo Version Requirement

**This project uses Expo SDK 54.** Always verify APIs against the exact versioned docs:
https://docs.expo.dev/versions/v54.0.0/

Do not use APIs from memory of older Expo versions. Key breaking change areas:
- `expo-router` v6 — new APIs for layouts and typed routes
- `SafeAreaView` must come from `react-native-safe-area-context`, not `react-native`
- NativeWind 5 uses Tailwind CSS v4 — config is in `global.css`, not `tailwind.config.js`
