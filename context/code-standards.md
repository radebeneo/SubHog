# Code Standards

## General

- Keep components small and single-purpose — one screen = one file, one card = one component
- Fix root causes of bugs; do not add conditional workarounds around broken behavior
- Do not mix data-fetching logic, business logic, and render logic in the same component
- Prefer explicit over implicit — name props, types, and variables clearly even if verbose

## TypeScript

- Strict mode is enforced. No `any`, no `// @ts-ignore`, no implicit untyped parameters
- Define shared types in a `types/` folder (e.g. `types/subscription.ts`, `types/auth.ts`)
- Use `interface` for object shapes passed as props; use `type` for unions and aliases
- Always type the return value of context provider functions and custom hooks
- Validate and narrow data read from AsyncStorage before using it — it can be null or malformed

## Expo Router

- Use file-based routing exclusively. Do not create navigation stacks or tabs manually in component code
- Use `<Link>` for declarative navigation and `router.push()` / `router.replace()` for programmatic navigation
- Use `useLocalSearchParams<{ id: string }>()` (typed) to read dynamic route params — never `useRoute()` from React Navigation
- Layouts (`_layout.tsx`) own their navigator config (headers, tab bars, screen options)
- The root `_layout.tsx` is responsible for auth-gating: redirect to `(auth)` or `onboarding` when no session exists

## NativeWind / Styling

- All colors must come from NativeWind classes that resolve to tokens in `global.css` (`@theme` block)
- Never use inline `style={{ color: '...' }}` for colors, spacing, or typography that has a token
- Repeated visual patterns must use the semantic component classes defined in `@layer components` in `global.css` (e.g. `auth-card`, `sub-card`, `home-balance-card`)
- New repeated patterns should be added to `global.css @layer components` — not written inline each time
- Border radius: use `rounded-2xl` for cards, `rounded-full` for pill/icon buttons, `rounded-3xl` for modals
- Typography: always use font family utility classes (`font-sans-bold`, `font-sans-medium`, etc.) — never rely on the system default font

## React Native

- Always wrap screens in `<SafeAreaView>` (from `react-native-safe-area-context`) as the outermost element
- Use `<ScrollView>` for vertically scrollable content; use `<FlatList>` when rendering lists of dynamic data
- Use `<Pressable>` for touchable elements — not `<TouchableOpacity>` (deprecated pattern)
- Animated values must use `react-native-reanimated` (`useSharedValue`, `useAnimatedStyle`) — not the legacy `Animated` API
- Never use `setNativeProps` or direct ref mutations for state that should trigger re-renders

## State and Context

- Subscription data lives in `SubscriptionContext`. Components consume it via `useSubscriptions()` hook
- Auth state lives in `AuthContext`. Components consume it via `useAuth()` hook
- No component may store a copy of the subscription list in its own `useState` — always read from context
- AsyncStorage reads happen once on app mount (inside the context provider). UI reads come from context state

## File Organization

- `app/` — Expo Router screen files and layout files only; no business logic or shared components here
- `components/` — Reusable UI components (e.g. `SubscriptionCard`, `UpcomingCard`, `AddSubscriptionModal`)
- `context/` — React Context providers and their custom hooks (`SubscriptionContext.tsx`, `AuthContext.tsx`)  
  *(Note: this is `context/` as a source folder; the AI documentation lives in the `context/` directory at repo root — they are the same folder. Keep context providers inside the root `context/` folder with clear filenames to avoid confusion.)*
- `types/` — Shared TypeScript type definitions
- `assets/` — Images, icons, fonts — read-only
- `global.css` — Single source of truth for all design tokens and component utility classes

> **Note on folder naming conflict**: The `context/` directory at the project root contains both AI documentation files (`.md`) and will also contain React Context source files (`.tsx`). Keep them clearly separated by file extension — `.md` for docs, `.tsx` for source.
