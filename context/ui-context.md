# UI Context

## Theme

Light only. No dark mode in v1. The visual language is warm and approachable — a cream/off-white
background with a deep navy primary text color and a vivid burnt-orange accent. Cards are
slightly warmer than the background. The accent color (`#ea7a53`) is used for CTAs, tab active
states, and the balance card background. A teal-green (`#8fd1bd`) is used for expanded
subscription card backgrounds. Typography is weight-driven — Extrabold for headlines, Bold for
sub-headers and amounts, Medium for body and metadata.

## Colors

All components must use NativeWind classes that resolve to these tokens. No hardcoded hex values.

| Role                    | NativeWind Class          | Hex Value  |
| ----------------------- | ------------------------- | ---------- |
| Page background         | `bg-background`           | `#fff9e3`  |
| Card background         | `bg-card`                 | `#fff8e7`  |
| Muted surface           | `bg-muted`                | `#f6eecf`  |
| Primary text            | `text-primary`            | `#081126`  |
| Muted / secondary text  | `text-muted-foreground`   | `rgba(0,0,0,0.6)` |
| Accent (CTA, active)    | `bg-accent` / `text-accent` | `#ea7a53` |
| Border                  | `border-border`           | `rgba(0,0,0,0.1)` |
| Success                 | `text-success`            | `#16a34a`  |
| Destructive / Error     | `text-destructive`        | `#dc2626`  |
| Subscription expand bg  | `bg-subscription`         | `#8fd1bd`  |

## Typography

All font classes resolve to custom font families registered via `expo-font`.

| Role              | NativeWind Class        | CSS Token             |
| ----------------- | ----------------------- | --------------------- |
| Regular body      | `font-sans`             | `--font-sans`         |
| Light weight      | `font-sans-light`       | `--font-sans-light`   |
| Medium weight     | `font-sans-medium`      | `--font-sans-medium`  |
| Semibold          | `font-sans-semibold`    | `--font-sans-semibold`|
| Bold              | `font-sans-bold`        | `--font-sans-bold`    |
| Extrabold         | `font-sans-extrabold`   | `--font-sans-extrabold`|

- Page titles: `text-3xl font-sans-bold`
- Section titles / card labels: `text-2xl font-sans-bold`
- Subscription names / list titles: `text-lg font-sans-bold`
- Prices and amounts: `text-lg font-sans-bold` (home balance: `text-4xl font-sans-extrabold`)
- Metadata / secondary labels: `text-sm font-sans-semibold text-muted-foreground`
- Body text: `text-base font-sans-medium`
- Input labels: `text-sm font-sans-semibold`
- Auth wordmark: `text-3xl font-sans-extrabold`

## Border Radius

| Context                  | NativeWind Class     |
| ------------------------ | -------------------- |
| Input fields             | `rounded-2xl`        |
| Subscription cards       | `rounded-2xl`        |
| Subscription icon        | `rounded-lg`         |
| Auth card                | `rounded-3xl`        |
| Bottom-sheet modal       | `rounded-t-3xl`      |
| Balance card (asymmetric)| `rounded-bl-4xl rounded-tr-4xl` |
| Pill buttons / tab icons | `rounded-full`       |
| Avatar                   | `rounded-full`       |

## Component Library

No third-party component library. All UI is built from React Native primitives (`View`, `Text`,
`Pressable`, `ScrollView`, `FlatList`, `TextInput`, `Modal`) styled entirely with NativeWind
utility classes and the semantic component classes defined in `global.css`.

Semantic component classes live in `global.css` under `@layer components`. Always use these
classes for repeating patterns:

| Pattern                  | Classes to use                                          |
| ------------------------ | ------------------------------------------------------- |
| Home header row          | `home-header`, `home-user`, `home-avatar`, `home-user-name` |
| Balance card             | `home-balance-card`, `home-balance-label`, `home-balance-amount` |
| Upcoming renewal card    | `upcoming-card`, `upcoming-icon`, `upcoming-price`, `upcoming-name` |
| Subscription list card   | `sub-card`, `sub-head`, `sub-main`, `sub-icon`, `sub-title`, `sub-meta` |
| Expanded subscription    | `sub-card-expanded`, `sub-body`, `sub-details`, `sub-row` |
| Auth screens             | `auth-safe-area`, `auth-content`, `auth-card`, `auth-form`, `auth-input` |
| Auth buttons             | `auth-button`, `auth-button-text`, `auth-secondary-button` |
| Bottom-sheet modal       | `modal-overlay`, `modal-container`, `modal-header`, `modal-body` |
| Billing cycle picker     | `picker-row`, `picker-option`, `picker-option-active`   |
| Category chip picker     | `category-scroll`, `category-chip`, `category-chip-active` |
| Tab bar icons            | `tabs-icon`, `tabs-pill`, `tabs-active`, `tabs-glyph`   |

## Layout Patterns

- **Root layout**: Stack navigator with `headerShown: false`. All navigation chrome is rendered by individual screens.
- **Tab bar**: Bottom tabs with 4 items: Home, Subscriptions, Insights, Settings. Active tab uses `tabs-active` (accent background pill).
- **Home screen**: `SafeAreaView` → `ScrollView` → header row → balance card → upcoming horizontal scroll → active subscription list (vertical).
- **Subscription card inline expand**: Tapping a `sub-card` toggles an `expanded` boolean in local state. The card animates to show `sub-body` details below. Use `react-native-reanimated` for the height animation.
- **Add Subscription modal**: React Native `<Modal>` with `transparent` + `animationType="slide"`. Renders as a bottom sheet using `modal-container` (`.mt-auto.max-h-[85%].rounded-t-3xl`). Backdrop is `modal-overlay` (`.bg-black/50`).
- **Auth screens**: `SafeAreaView` → `ScrollView` → brand block (logo + wordmark) → auth card → form fields → submit button → link to other auth screen.
- **Onboarding**: Full-viewport layout, no tab bar, single screen with illustration, title, subtitle, and CTA button.

## Icons

`@expo/vector-icons` (Ionicons set). Stroke-style icons only.

| Usage                    | Size           |
| ------------------------ | -------------- |
| Tab bar icons            | `size-6` (24px) via `tabs-glyph` class |
| Home add button          | `size-12` via `home-add-icon` class |
| Inline UI icons (labels) | 18–20px        |
| Avatar placeholder       | 24px           |
