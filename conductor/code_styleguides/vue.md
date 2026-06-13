# Vue 3 Styleguide

Standards for Clash Tracker's Vue 3 + Vite frontend. Mobile-first, themed, accessible.

## Components

- **`<script setup lang="ts">`** with the Composition API for all components.
- **One component per `.vue` file**; PascalCase filenames (`PlayerRow.vue`,
  `QualificationLine.vue`).
- Keep components **presentational**. Data fetching and decisions live in **composables**
  and `@clash-tracker/core`, not in templates.
- Type `defineProps` and `defineEmits` with TypeScript generics:
  ```vue
  <script setup lang="ts">
  const props = defineProps<{ player: PlayerStats; aboveLine: boolean }>();
  const emit = defineEmits<{ swap: [playerTag: string] }>();
  </script>
  ```
- Props are **read-only** — never mutate a prop; emit an event instead.

## Composables

- Name `useX` (`usePlayers`, `useSwipeNav`, `useSession`). Return refs/computed + functions.
- Keep them **pure where possible**; isolate side effects (Firestore reads, timers).
- Reuse `@clash-tracker/core` for ranking/eligibility — composables adapt data, they don't
  re-derive domain rules.

## State

- **Pinia** for cross-view state (session/user, clan settings). Define stores with the
  setup syntax; keep actions small.
- **@tanstack/vue-query** for server data (players, wars): gives caching, dedup, and
  `isLoading`/`isError` states for free. Don't hand-roll fetch-in-`onMounted`.

## Styling

- **Scoped styles** in the SFC. Reference theme **CSS custom properties**
  (`var(--ct-gold)`, `var(--ct-space-2)`) — never hardcode colors/sizes that belong to the
  theme.
- Mobile-first: base styles target ~360–430px; add `min-width` media queries to enhance.
- Touch targets ≥44×44px; visible `:focus-visible` states.

## Templates & accessibility

- Semantic elements (`<button>`, `<nav>`, `<ul>`); ARIA labels for icon-only controls.
- Every data view renders explicit **loading / empty / error** states.
- Don't convey meaning by color alone (qualification line pairs color with icon + label).
- Respect `prefers-reduced-motion` in transitions.

## Motion / navigation

- Use Vue `<Transition>`/`<TransitionGroup>` and VueUse `useSwipe` for the swipe nav.
- Honor the **250ms rule**: slow drags follow the finger; quick flicks complete within
  250ms. Start loading the target view's data as the swipe begins.

## Testing

- **Vue Test Utils / @testing-library/vue** + Vitest. Test rendered behavior and states,
  not implementation details.
- Mount with the data a real composable would provide (in-memory), assert what the user
  sees (e.g. above-the-line players carry the qualified styling/label).

## Quick reference

| Aspect | Recommendation |
|--------|----------------|
| API style | `<script setup lang="ts">` + Composition API |
| Domain logic | In `@clash-tracker/core`, not components |
| Server data | `@tanstack/vue-query` |
| Shared state | Pinia (setup stores) |
| Styling | Scoped SFC + CSS custom-property theme tokens |
| First viewport | ~360–430px mobile |
| Every view | loading / empty / error states |
