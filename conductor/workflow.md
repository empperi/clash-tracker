# Project Workflow: Clash Tracker

This is the binding workflow for all Clash Tracker development. It is customized for this
project from the Conductor default. **Implementation is done by a fast model (e.g. Gemini)
following `plan.md`; specs and plans are authored by Opus.**

## Project settings

| Setting | Value |
|---------|-------|
| Coverage Target | **80%** (aim ~100% in `@clash-tracker/core`) |
| Commit Strategy | **Per task** |
| Git Notes | **Enabled** (task summary + phase verification reports) |
| Mobile Testing | **Required** (mobile-first product) |
| Parallel Agents | worktree |

## Guiding principles

1. **The Plan is the source of truth.** All work is tracked in the track's `plan.md`.
2. **The Tech Stack is deliberate.** Any deviation from `tech-stack.md` is documented there
   (with a dated note) *before* implementing.
3. **Test-Driven Development.** Write a failing test first, then the code to pass it.
4. **Functional first.** Pure functions, no shared mutable state; inject dependencies
   (clock, ids, repositories) as function parameters instead of using mocks. See
   `tech-stack.md` → "Functional architecture".
5. **High coverage.** ≥80% for new code.
6. **Mobile-first UX.** Every UI task must look and work right on a phone first.
7. **Guard the secret.** Never log, expose, or ship the CoC API token to the client.
8. **Non-interactive & CI-aware.** Prefer non-interactive commands; use `CI=true` for
   watch-mode tools so they run once.

## Standard task workflow (TDD)

Each task in `plan.md` is one Red → Green → Refactor cycle.

1. **Select** the next unchecked task in `plan.md` (sequential order).
2. **Mark in progress:** change its checkbox `[ ]` → `[~]`.
3. **Red — write failing tests:** create the test file; write unit tests defining the
   expected behavior/acceptance criteria. Run them and **confirm they fail**. Do not
   proceed without a red test.
   - Pure logic (`@clash-tracker/core`, composables, utilities) → plain Vitest unit tests,
     no I/O.
   - Repositories → tests against the **Firestore emulator** (real DB, no mocks).
   - Components → Vue Test Utils / Testing Library asserting rendered states.
4. **Green — implement:** write the minimum code to make the tests pass. Run the suite and
   confirm green.
5. **Refactor:** improve clarity/remove duplication with tests still green. Keep functions
   pure and small; prefer immutability.
6. **Verify coverage:** `CI=true npm test -- --coverage` (or per-workspace). Target ≥80% for
   new code.
7. **Document deviations:** if implementation diverged from `tech-stack.md`, STOP, update
   `tech-stack.md` with a dated note, then resume.
8. **Commit** the code (Conventional Commits, see below).
9. **Attach a git note** to the commit summarizing the task (what changed, files, the why).
10. **Record SHA in plan:** set the task `[~]` → `[x]` and append the 7-char commit SHA.
11. **Commit the plan update** (`conductor(plan): Mark task '<name>' complete`).

## Phase completion & checkpoint

When a task also finishes a phase:

1. Announce the phase is complete.
2. Ensure every changed **code** file (exclude `.json`, `.md`, `.yaml`) has corresponding
   tests; create any missing ones matching the repo's conventions.
3. Run the full suite (announce the exact command, e.g. `CI=true npm test`). If it fails,
   debug — at most **two** fix attempts, then stop and ask for guidance.
4. Propose a **manual verification plan** (concrete steps + expected outcome). For frontend
   phases this includes running `npm run dev --workspace web` against the emulators and what
   to look for on a mobile viewport.
5. **Await explicit user confirmation** ("yes" or feedback). Pause.
6. Create a **checkpoint commit** (`conductor(checkpoint): Checkpoint end of Phase X`).
7. Attach a git note with the full verification report.
8. Append `[checkpoint: <sha>]` to the phase heading in `plan.md`; commit the plan update.

## Quality gates (before any task is "done")

- [ ] All tests pass; coverage ≥80% for new code.
- [ ] Pure logic has no hidden I/O; dependencies injected, not mocked.
- [ ] Repository changes covered by emulator tests.
- [ ] Code follows `conductor/code_styleguides/` (TypeScript, Vue).
- [ ] Public functions documented (JSDoc/TSDoc).
- [ ] Strict types; no `any`.
- [ ] No lint / `vue-tsc` / `tsc` errors.
- [ ] **Mobile**: looks and works correctly at ~360–430px; touch targets ≥44px.
- [ ] No CoC token or non-public data reaches the client; nothing secret logged.

## Commit guidelines (Conventional Commits)

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Conductor-internal
commits use `conductor(...)`. Common scopes: `core`, `functions`, `web`, `ingestion`,
`auth`, `player-list`, `admin`, `owner`, `war-plan`, `pwa`, `firebase`.

Examples:
```
feat(ingestion): Persist war attacks from current war endpoint
test(core): Add attack-usage % aggregation tests
feat(player-list): Render above/below qualification line
```

End commit messages with a co-author trailer naming **the agent that actually did the
work** — not a fixed value. Each agent uses its own identity:
```
Co-Authored-By: <Agent Name> <noreply@example.com>
```
Examples: `Co-Authored-By: Gemini <noreply@google.com>` when Gemini implements a task;
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` when Claude authors specs/plans.
Use the trailer that matches whoever is committing.

## Definition of Done

A task is done when: code matches spec; unit (and emulator, where relevant) tests pass;
coverage met; docs updated; lint/type-check clean; mobile verified where applicable;
`plan.md` updated with the SHA; committed with a git note.

## Notes for the implementing model

- Follow `plan.md` **in order**, one task at a time. Don't batch tasks into one commit.
- When a task is ambiguous, prefer the behavior described in the track's `spec.md` and
  `conductor/product.md`; if still unclear, leave a `TODO(question)` and continue, then
  surface it.
- Reuse `@clash-tracker/core` for any decision logic — don't reimplement ranking/eligibility
  in the UI or functions.
