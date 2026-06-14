# AGENTS.md — Clash Tracker

Lean operating guide for any AI agent working in this repo. Read this first; follow the
linked Conductor docs for detail. **Don't duplicate those docs here.**

## What this is

Mobile-first PWA tracking Clash of Clans war participation to pick a reliable CWL roster.
Public site is read-only; admins/owners log in (magic link) for write actions.

## Where the rules live (read as needed, don't inline)

- Product & domain rules → `conductor/product.md`
- UX / look & feel → `conductor/product-guidelines.md`
- Tech decisions & data model → `conductor/tech-stack.md`
- Workflow (TDD, commits, checkpoints) → `conductor/workflow.md`
- Build order & tracks → `conductor/tracks.md` (+ `conductor/tracks/<id>/`)
- Code style → `conductor/code_styleguides/{typescript,vue}.md`

## Non-negotiable principles

1. **TDD always.** Red → Green → Refactor. No production code without a failing test first.
2. **Functional first.** Pure functions, no shared mutable state, immutable data. Inject
   side-effecting deps (clock, ids, repositories, http) as parameters — **don't use mocking
   libraries**; pass in-memory/real implementations instead.
3. **Pure core, impure edges.** All decision logic (ranking, eligibility, medians, CWL
   planning) lives in `@clash-tracker/core` with zero I/O. Firebase only in `functions/`
   and `web/`. Never re-derive domain rules in the UI.
4. **Repositories are the only Firestore callers** and are tested against the **Firebase
   emulator**, not mocks.
5. **Guard the secret.** The CoC API token is encrypted at rest, never sent to the client,
   never logged. No private/secret data reaches the browser.
6. **Mobile first.** Every UI works at ~360–430px before desktop; touch targets ≥44px.
7. **Strict TypeScript.** No `any`. Named exports. `Result<T,E>` for expected failures.
8. **Follow the plan.** Work `plan.md` tasks in order, one per commit. Don't batch.

## Repo layout

```
packages/core/   Pure domain logic (no Firebase, no I/O). ~100% test coverage.
functions/       Cloud Functions: CoC gateway, ingestion, auth, repositories.
web/             Vue 3 + Vite PWA.
conductor/       Specs, plans, product/tech/workflow docs.
```

## Commands

```bash
npm install                       # install all workspaces
npm test                          # run all tests (requires active emulators for repo tests)
npm run test:emulator             # run all tests within the Firebase Emulator Suite
npm run lint                      # lint all workspaces
npm run emulators                 # Firebase emulators (Firestore/Auth/Functions/Storage)
npm run dev --workspace web       # run the PWA against emulators
```

> **Note on repository tests**: Firestore/Auth repository tests require the emulator suite to be active. You can run them via `npm run test:emulator` (which spins up the emulators, runs the test suite, and tears them down) or by starting the emulators via `npm run emulators` and executing `npm test` in another terminal window. Ensure test documents use isolated paths/collections to avoid collisons.

Use `CI=true` for watch-mode tools so they run once.

## Commits (Conventional Commits)

`feat|fix|test|refactor|docs|chore(scope): description` — one task per commit. End messages
with a `Co-Authored-By:` trailer naming **your own** agent identity (e.g.
`Co-Authored-By: Gemini <noreply@google.com>`), not a fixed value. See
`conductor/workflow.md` for the full loop (git notes, plan SHA recording, phase checkpoints).

## When unsure

Prefer the behavior in the track's `spec.md` + `conductor/product.md`. If still ambiguous,
leave a `TODO(question)` and surface it — don't guess silently.
