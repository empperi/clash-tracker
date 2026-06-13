# Spec: Foundation, App Shell, Navigation, PWA, Design System

**Track:** `foundation_20260613` · **Order:** 1 · **Depends on:** none

## Overview

Stand up the project skeleton everything else builds on: the npm-workspace monorepo with
`@clash-tracker/core`, `functions`, and `web`; a running Vue 3 + Vite PWA shell with the
Clash-themed design system; and the swipe-based view navigation with the required motion
physics. No real data yet — views are placeholders. This track makes `npm install`,
`npm test`, `npm run dev`, and the Firebase emulators all work.

## Background

See `conductor/tech-stack.md` (Vue 3 + Vite, Firebase, monorepo, functional architecture)
and `conductor/product-guidelines.md` (Clash theme, mobile-first, 250ms swipe rule, PWA,
accessibility). The basic Firebase config (`firebase.json`, rules, indexes) and workspace
`package.json` stubs already exist at the repo root.

## Functional Requirements

### FR-1 — Workspace & tooling
- **Description:** Configure the monorepo so all three workspaces build, type-check, lint,
  and test.
- **Acceptance criteria:**
  - `npm install` at root installs all workspaces.
  - Root `tsconfig.base.json` with strict mode; each workspace extends it.
  - ESLint + Prettier configured (TS + Vue); `npm run lint` passes on the scaffold.
  - Vitest configured per workspace; `npm test` runs green on a trivial sample test in each.
- **Priority:** High

### FR-2 — `@clash-tracker/core` package
- **Description:** Create the pure-domain package with a barrel `index.ts`, a sample pure
  function + test, and build/test scripts.
- **Acceptance criteria:** importable from `web` and `functions`; `vitest run` passes; no
  Firebase or I/O dependencies present.
- **Priority:** High

### FR-3 — Vue 3 app shell
- **Description:** A running Vite + Vue 3 app with Vue Router, Pinia, and
  `@tanstack/vue-query` installed and wired.
- **Acceptance criteria:**
  - App boots with `npm run dev --workspace web`.
  - A header showing clan name + logo placeholders (will be owner-configurable later).
  - Routes/placeholder views exist for: **Player List** (default), **War Plan**, **Admin**,
    **Owner**. Admin/Owner are reachable but show "placeholder" content for now.
  - A bottom (mobile) / top nav lets the user tap to switch views.
- **Priority:** High

### FR-4 — Swipe navigation with motion physics
- **Description:** Swipe horizontally to move between adjacent views; tapping a nav target
  animates as a swipe too (same behavior on desktop).
- **Acceptance criteria:**
  - Horizontal drag moves the views with the finger (1:1) when the gesture is slow.
  - A quick flick (gesture faster than 250ms) completes the transition within **250ms**.
  - A slow drag past a threshold settles to the next/prev view; otherwise snaps back.
  - `prefers-reduced-motion` → no slide, instant/cross-fade change.
  - The pure decision "given drag distance, velocity, duration → settle to next/prev/stay"
    lives in `@clash-tracker/core` and is unit-tested independent of the DOM.
- **Priority:** High

### FR-5 — Design system / theme
- **Description:** A global theme of CSS custom properties implementing the Clash look, plus
  a few base UI primitives (Button, Panel/Card, AppHeader, ListRow).
- **Acceptance criteria:**
  - One theme file defines color, font, spacing, radius tokens; components use tokens only.
  - Primitives render correctly at ~360px and scale up; touch targets ≥44px.
  - WCAG AA contrast on themed backgrounds.
- **Priority:** High

### FR-6 — PWA
- **Description:** Installable PWA via `vite-plugin-pwa`.
- **Acceptance criteria:** valid manifest (name, theme color, icons), service worker
  registers, app installs and launches standalone; built app passes a basic PWA audit.
- **Priority:** Medium

### FR-7 — Firebase client + emulator wiring
- **Description:** Initialize the Firebase web SDK and connect to emulators when
  `VITE_USE_EMULATORS=true`.
- **Acceptance criteria:** app talks to the Firestore/Auth emulators locally; production
  config read from env; no secrets in client code.
- **Priority:** Medium

### FR-8 — CI/CD via GitHub Actions
- **Description:** Continuous integration on every push and a tag-gated production deploy.
  This is a **single-developer, no-PR** project — work flows straight to `main`/`master`.
- **Acceptance criteria:**
  - **CI (on every push to any branch):** install, type-check, lint, and run the **full test
    suite** (unit + emulator-backed). Tests run against the Firebase Emulator Suite in CI.
    A failing test fails the workflow.
  - **Deploy (on git tags matching `release-*`,** e.g. `release-2026-06-13-22-24`**):** build
    and `firebase deploy` (hosting + functions + rules). The deploy job **depends on the
    test job passing** — if tests fail, no deploy happens.
  - Firebase auth in CI uses a service-account / token stored as a GitHub **secret**
    (`FIREBASE_SERVICE_ACCOUNT` or `FIREBASE_TOKEN`); the CoC token encryption key and any
    runtime secrets are GitHub secrets, never committed.
  - The CI/CD behavior is documented in `README.md`.
- **Priority:** High

## Non-Functional Requirements
- **NFR-1 (Perf):** Initial mobile load is lean; route views code-split.
- **NFR-2 (Quality):** ≥80% coverage on new logic; `core` near 100%. Strict TS, no `any`.
- **NFR-3 (Security):** No secret/private data fetched by the client; Firebase config via env.

## User Stories
- *As a clan member,* I can open the app on my phone and swipe between views smoothly, *so
  that* it feels like a native app.
- *As a developer,* I have a tested monorepo skeleton, *so that* later tracks just add
  features.

## Technical Considerations
- Swipe physics: separate the **pure decision** (settle target from distance/velocity/
  duration) from the **DOM/gesture wiring** so the rule is unit-testable.
- Keep placeholder views thin; real content comes in later tracks (Player List → Track 5,
  War Plan → Track 9, Admin → 7, Owner → 8).
- CI/CD: single developer, **no pull requests** — pushes go directly to `main`/`master`.
  CI runs on push; deploys are gated on a `release-*` tag *and* green tests. Emulator-backed
  tests need the Firebase Emulator Suite available in the CI job.

## Out of Scope
- Real player/war data, auth, settings persistence, any CoC API calls.

## Open Questions
- Final icon/splash artwork — placeholder assets acceptable until owner branding exists.
