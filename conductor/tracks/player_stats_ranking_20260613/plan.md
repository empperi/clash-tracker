# Implementation Plan: Player Stats & Ranking Domain

Track `player_stats_ranking_20260613`. TDD per `conductor/workflow.md`. Phases 1–4 are
**pure** logic in `@clash-tracker/core` (aim ~100% coverage). Phase 5 persists via
emulator-tested repositories.

> Implementer note: this defines the product's credibility. Write thorough tests, especially
> boundary values (`>=` semantics) and tie-break chains. Document the rounding and
> divide-by-zero rules in a comment and reuse them.

## Phase 1: Math & aggregation primitives (pure) [checkpoint: 056e945]

Goal: trustworthy building blocks.

- [x] bf987e4 Task: Tests + implement `median(values: readonly number[])`: odd/even length, single,
  empty (decide → 0 or null and document). Must not mutate input.
- [x] a55b78a Task: Tests + implement `attackUsagePct({ attacksDone, attacksAvailable })` with the
  documented divide-by-zero (available 0 → 0) and rounding rule.
- [x] Verification: primitives green. [checkpoint: 056e945]

## Phase 2: Per-player aggregation (pure) [checkpoint: 8c66c65]

Goal: full per-player stat object from per-war records.

- [x] e14c822 Task: Define the input type (a player's per-war records: attacks with stars/
  destruction, attacks available, defenses faced, own-base destruction, war timestamp) and
  the output `PlayerStats` type in `core`.
- [x] b7c6f19 Task: Tests + implement `aggregatePlayerStats(records)` computing wars participated,
  attacks done/available, attack-usage %, median destruction, median stars, median
  defenses-per-war, median own-destruction-per-war, and `lastWarParticipatedAt`. Cover: no
  wars, one war, multiple wars, missed attacks, never-attacked, never-defended.
- [x] Verification: aggregation matches hand-computed fixtures. [checkpoint: 8c66c65]

## Phase 3: Eligibility split (pure) [checkpoint: 652bb36]

Goal: the two lists + qualification line.

- [x] 3915ca2 Task: Tests + implement `splitByParticipation(players, minWarParticipation)` →
  `{ qualifiedPool, notEnoughWars }` using `>=`. Boundary: exactly == min → qualified pool.
- [x] 09d9bc2 Task: Tests + implement `markQualification(qualifiedPool, acceptancePct)` setting
  `aboveLine = attackUsagePct >= acceptancePct`. Boundary: exactly == → above the line.
- [x] Verification: split + line correct at boundaries. [checkpoint: 652bb36]

## Phase 4: Ordering comparator (pure, higher-order) [checkpoint: 65c819e]

Goal: the six-key sort for both lists.

- [x] 98aea26 Task: Tests + implement small key-extractors and a `composeComparators(...)` helper
  (higher-order) so the order is declared as a list of (extractor, direction).
- [x] e0b7c94 Task: Tests + implement `byClanRoleRank` (Leader>Co-Leader>Elder>Member) and the full
  `rankPlayers` comparator in the exact priority from `product.md`. Tests must walk each
  tie-break level (equal usage% → wars decide; equal wars → median stars; …; finally role).
- [x] ed93599 Task: Provide `sortPlayers(list)` returning a new sorted array (no mutation).
- [x] Verification: ordering exactly matches the spec, including deep tie-breaks. [checkpoint: 65c819e]

## Phase 5: Recompute & persist (emulator-tested)

Goal: write `players/*` aggregates after ingestion.

- [ ] Task: Emulator tests + implement `PlayerRepository`: `upsertPlayer`,
  `getCurrentPlayers` (`inClan=true`), `getPastPlayers` ordered by `lastWarParticipatedAt`
  desc (uses the composite index), with pagination support for infinite scroll later.
- [ ] Task: Tests + implement `makeRecomputePlayerStats({ warRepo, playerRepo, clanRepo })`:
  load tracked wars + latest clan member list, compute aggregates via the pure functions,
  upsert players, mark leavers `inClan=false` (retained). Drive the logic with in-memory
  deps in unit tests; one emulator test for the end-to-end persistence.
- [ ] Task: Hook recompute to run after a successful ingestion (call it from the Track 3 use
  case or a Firestore trigger on war writes — choose, keep the handler thin, test the wiring).
- [ ] Verification: after ingesting fixture wars, `players/*` holds correct aggregates;
  leavers retained and partitioned correctly. [checkpoint]

## Done when
- Aggregates, medians, attack-usage %, the two-list split, the qualification line, and the
  six-key ordering are implemented as pure, ~fully-covered functions, and current/past
  player aggregates are persisted and queryable. Track 5 can render straight from this.
