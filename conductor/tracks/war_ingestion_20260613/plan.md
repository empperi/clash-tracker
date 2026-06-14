# Implementation Plan: War Tracking & Ingestion

Track `war_ingestion_20260613`. TDD per `conductor/workflow.md`. The **decision logic**
(identity, diff, sync) is pure → `@clash-tracker/core`; **persistence** → `functions/`
repositories (emulator-tested); the **scheduled function** is a thin wrapper.

> Implementer note: correctness here is paramount — this is the canonical attack record.
> Write the idempotency tests first and make them ruthless (apply the same fetch twice,
> assert identical state).

## Phase 1: War & attack identity (pure) [checkpoint: 1ec8d36]

Goal: deterministic ids so repeated polls converge.

- [x] 919982c Task: Tests + implement `warId(war)` in `core` — stable across polls of the same war,
  distinct for a new opponent/prep-start. Cover edge cases (same opponent in a later war →
  different id because prep start differs).
- [x] 919982c Task: Tests + implement `attackId(attack)` — unique per attack (attacker + defender +
  round/order). Two distinct attacks never collide; the same attack across polls → same id.
- [ ] Verification: identity tests green. [checkpoint]

## Phase 2: Ingestion diff & sync (pure) [checkpoint: cc2a014]

Goal: idempotent, lossless merge logic.

- [x] e8ef0f2 Task: Add fixtures simulating the same war fetched at several points (prep, mid-war
  with N attacks, more attacks later, warEnded). 
- [x] e8ef0f2 Task: Tests + implement `diffWar(stored, fetched)` returning `{ warHeader,
  memberUpdates, attacksToAdd }`. Assertions: first ingest (stored=none) yields the full
  war; a later fetch with extra attacks yields only the new attacks; re-applying the same
  fetch yields an empty `attacksToAdd`. **Idempotency test is mandatory.**
- [x] e8ef0f2 Task: Tests + implement `computeSyncState(stored, fetched)` → `'synced' |
  'out-of-sync'`, plus a helper to set `lastSyncedAt` (time injected).
- [ ] Verification: applying a diff twice == applying once; sync state correct. [checkpoint]

## Phase 3: Repositories (emulator-tested) [checkpoint: b01df82]

Goal: persist wars, members, attacks.

- [x] c94bf5e Task: Emulator tests + implement `WarRepository`: `getWar(warId)`, `saveWarHeader`,
  `upsertMembers`, returning typed domain objects.
- [x] 99aecf3 Task: Emulator tests + implement `AttackRepository`: `addAttacks(warId, attacks)`
  keyed by `attackId` (idempotent writes — adding the same attack twice leaves one doc),
  `listAttacks(warId)`.
- [x] 99aecf3 Task: Emulator test: full round-trip — save war + members + attacks, read back, assert
  shape and counts.
- [ ] Verification: repeated `addAttacks` of the same set → no duplicates. [checkpoint]

## Phase 4: Ingestion use case (pure orchestration over injected deps)

Goal: one tested function that ingests a current-war fetch.

- [ ] Task: Tests + implement `makeIngestCurrentWar({ gateway, warRepo, attackRepo, now })`
  returning `async () => Result<IngestSummary>`. Drive it with in-memory repos + a fake
  gateway returning fixtures:
  - `notInWar`/preparation-only → no war persisted, summary says "nothing to ingest".
  - first `inWar` fetch → war + members + attacks stored, state `synced`.
  - second fetch with new attacks → only new attacks added.
  - re-running the same fetch → no changes (idempotent), still `synced`.
  - `warEnded` fetch → final snapshot captured, war marked ended.
  - gateway error (429/maintenance) → `Result` failure, **no state mutation**, sync flagged
    out-of-sync.
- [ ] Verification: all ingestion scenarios green using in-memory deps. [checkpoint]

## Phase 5: Scheduled function + manual trigger

Goal: run ingestion automatically and on demand.

- [ ] Task: Wire a scheduled Cloud Function (e.g. every 20 min) that constructs the use case
  with real gateway + repositories (key/clan tag from config) and runs it. Keep the handler
  ~5 lines; test that it delegates to the use case (inject the use case).
- [ ] Task: Add a callable `triggerIngestNow` running the same use case once and returning
  the sync status. (Auth gating deferred to Track 6 — note this; for now restrict to
  emulator/internal.)
- [ ] Task: Add back-off/logging for rate-limit/maintenance results; assert (via the use
  case result) that failures don't write partial data. Confirm no token is logged.
- [ ] Verification: against the emulator + seeded secrets, run the trigger during a real or
  fixture war and confirm `wars/*` + attacks populate and re-running doesn't duplicate.
  [checkpoint]

## Done when
- A scheduled function reliably records classic wars idempotently and losslessly, maintains
  sync status, survives API failures without corruption, and is fully covered by unit
  (pure) + emulator (repository) tests.
