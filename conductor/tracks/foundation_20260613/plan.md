# Implementation Plan: Foundation, App Shell, Navigation, PWA, Design System

Track `foundation_20260613`. Follow `conductor/workflow.md` (TDD, per-task commits).
Each task = one Red→Green→Refactor cycle. Keep domain decisions pure and in
`@clash-tracker/core`.

> Implementer note: prefer official scaffolds (`npm create vite@latest`) then adapt. Do not
> hand-write config you can generate. Use exact package names from `tech-stack.md`.

## Phase 1: Monorepo & tooling [checkpoint: 6770ce5]

Goal: all three workspaces install, type-check, lint, and test.

- [x] c9adadf Task: Add root `tsconfig.base.json` (strict, `moduleResolution: bundler`, `target
  ES2022`). Add a trivial typed util in `packages/core/src/index.ts` and a Vitest test for
  it; confirm `npm test --workspace @clash-tracker/core` is red→green.
- [x] cd2fb6f Task: Configure Vitest in `packages/core` (config file + `vitest` devDep). Verify the
  sample test passes and coverage reporting works.
- [x] b6d21f5 Task: Add ESLint (typescript-eslint) + Prettier at root with a shared config; wire
  `lint` scripts. Lint passes on the scaffold. (No tests; this is a chore task — still
  commit separately.)
- [x] 7e55080 Task: Add `vue-tsc`/`tsc` typecheck scripts per workspace; ensure `npm run build
  --workspaces --if-present` succeeds on the scaffold.
- [x] 6770ce5 Verification: `npm install && npm test && npm run lint` all green from root. [checkpoint]

## Phase 2: Core domain package [checkpoint: bba00df]

Goal: `@clash-tracker/core` is a real, importable, pure package.

- [x] 02dbbf0 Task: Define the package's public barrel and a `Result<T,E>` type + helper
  (`ok`/`err`) with tests. No I/O.
- [x] a48a5a1 Task: Add shared domain **types** consumed later (e.g. `ClanRole`, `PlayerStats`,
  `War`, `WarType`, `SyncState`) as `readonly` interfaces/types. Add a type-level/sample
  test ensuring they compile and a small pure helper (e.g. `clanRoleRank`) with tests.
- [x] 7b8f614 Verification: import `@clash-tracker/core` from a throwaway test in `web` and
  `functions` to prove resolution works. [checkpoint]

## Phase 3: Vue app shell [checkpoint: 900f044]

Goal: a running themed app with routed placeholder views and nav.

- [x] 5df7f38 Task: Scaffold the Vue 3 + Vite + TS app in `web/` (Composition API, `<script
  setup>`). Add `main.ts` wiring Pinia, Vue Router, and `@tanstack/vue-query`. Smoke test:
  mounting `App.vue` renders the header (Vue Test Utils).
- [x] a3cb0e5 Task: Create placeholder views `PlayerListView`, `WarPlanView`, `AdminView`,
  `OwnerView` and register routes (Player List default). Test that each route renders its
  placeholder.
- [x] 3826406 Task: Build `AppHeader` showing clan-name + logo **placeholders** (props/slots; real
  values come from settings later). Test render at mobile width.
- [x] e33bf4e Task: Build a nav component (tap to switch view) reflecting the active route. Test
  active-state logic.
- [x] 900f044 Verification: `npm run dev --workspace web` shows the shell; can tap between views. [checkpoint]

## Phase 4: Swipe navigation & motion [checkpoint: 33be846]

Goal: natural swipe between adjacent views honoring the 250ms rule.

- [x] 14367ac Task (core, pure): Implement `resolveSwipe({ dx, viewWidth, durationMs, velocity })
  → 'next' | 'prev' | 'stay'` in `@clash-tracker/core`. Encode the rule: a flick faster
  than 250ms past a small distance/velocity threshold → next/prev; a slow drag settles by
  distance (>~40% width → change, else stay). Unit-test the boundary cases thoroughly (no DOM).
- [x] 59c5286 Task (core, pure): Implement `swipeTransition({ change, durationMs }) →
  { animateMs }` returning ≤250ms for flicks and a proportional duration for slow drags.
  Unit-test.
- [x] 43d6c44 Task (web): Build a `useSwipeNav` composable using VueUse `useSwipe` that, during a
  drag, translates the view container 1:1, and on release calls `resolveSwipe` to decide
  and `swipeTransition` to animate. Test the composable's state transitions with simulated
  gesture inputs (no real touch hardware needed — drive the handlers directly).
- [x] c942177 Task (web): Start loading the **target view's** data hook the moment a swipe begins
  (eager-load). For now wire a no-op/loading flag the placeholder views expose; assert the
  hook fires on drag start in a test.
- [x] d3b2bd0 Task (web): Honor `prefers-reduced-motion` → skip slide, instant/cross-fade. Test the
  branch via a matchMedia stub passed in (inject the matcher, don't read global).
- [x] Verification: manual — slow-drag follows finger and snaps; quick flick completes
  ≤250ms; reduced-motion disables slide. [checkpoint]
  Carousel reworked from snap-back to slide-to-target with wraparound; user-confirmed
  2026-06-14. Verified in a real browser (nav taps, left/right swipe, wraparound).

## Phase 5: Design system / theme

Goal: Clash-themed tokens and base primitives.

- [x] 34e77c8 Task: Add the global theme file (CSS custom properties: colors, fonts, spacing,
  radii) and document tokens. Add a font strategy (self-hosted display font or close
  free alternative). No test (CSS) — but include a visual checklist item.
- [ ] Task: Build `BaseButton`, `BasePanel`/`Card`, and `ListRow` primitives using only
  tokens. Test: render, slot content, ≥44px touch target (assert min-height style), and
  variant props.
- [ ] Task: Apply the theme to `AppHeader` and placeholder views so the app looks Clash-y.
- [ ] Verification: primitives reviewed at 360px and desktop; AA contrast checked. [checkpoint]

## Phase 6: PWA & Firebase client wiring

Goal: installable PWA that talks to emulators locally.

- [ ] Task: Add `vite-plugin-pwa` with manifest (name "Clash Tracker", theme color, icons)
  and autoUpdate service worker. Test that the manifest is generated in the build output.
- [ ] Task: Add a Firebase client init module reading config from `import.meta.env`;
  connect to Auth/Firestore emulators when `VITE_USE_EMULATORS==='true'`. Test the
  branch selection (inject env) — do not hit the network in unit tests.
- [ ] Task: Add app icons + offline fallback for read-only shell. Confirm SW registers.
- [ ] Verification: build, `firebase emulators:start`, install the PWA, confirm standalone
  launch and offline shell. [checkpoint]

## Phase 7: CI/CD (GitHub Actions)

Goal: tests on every push; tag-gated production deploy. **No PRs** — this is a single-dev
repo pushing straight to `main`/`master`.

- [ ] Task: Add `.github/workflows/ci.yml` — a **test** job triggered `on: push` (all
  branches). Steps: checkout, setup Node 20 (+ npm cache), `npm ci`, type-check, `npm run
  lint`, then `npm test` with the **Firebase Emulator Suite** available (run the suite via
  `firebase emulators:exec "npm test"` so emulator-backed repository tests work). The job
  fails if any test fails. Keep the job reusable (so deploy can depend on it).
- [ ] Task: Add a **deploy** job to the workflow that triggers only on tags matching
  `release-*` (e.g. `on: push: tags: ['release-*']`). It must `needs:` the test job so it
  **only runs when tests pass**. Steps: checkout, Node 20, `npm ci`, `npm run build`, then
  `firebase deploy --only hosting,functions,firestore:rules,storage` authenticating with the
  `FIREBASE_SERVICE_ACCOUNT`/`FIREBASE_TOKEN` GitHub secret. Use the project from
  `.firebaserc`.
  > Note: a single workflow can gate jobs with `needs:`; if splitting into two workflow
  > files instead, the deploy workflow must re-run (or require) the tests itself — never
  > deploy without green tests.
- [ ] Task: Document required GitHub **secrets** (`FIREBASE_SERVICE_ACCOUNT` or
  `FIREBASE_TOKEN`, `CLASH_TOKEN_ENC_KEY`, any runtime config) in the workflow file header
  and `README.md`. No secrets committed.
- [ ] Task: Update `README.md` with the CI/CD section (push → tests; `release-*` tag →
  gated deploy) — see the "Deployment & CI/CD" heading. Confirm the documented tag format
  matches the workflow trigger.
- [ ] Verification: push a trivial commit → CI runs tests and goes green/red correctly; push
  a `release-*` tag on a green commit → deploy runs; confirm a failing test blocks deploy.
  [checkpoint]

## Done when
- `npm install && npm test && npm run lint && npm run build` all green.
- App runs, swipes between 4 placeholder views with correct physics, installs as a PWA, and
  connects to emulators. `@clash-tracker/core` is importable and pure.
- GitHub Actions runs the full test suite on every push and performs a Firebase deploy only
  on a `release-*` tag with passing tests; the behavior is documented in `README.md`.
