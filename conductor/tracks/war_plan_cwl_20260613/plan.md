# Implementation Plan: War Plan (CWL)

Track `war_plan_cwl_20260613` (built last). TDD per `conductor/workflow.md`. The planning
**algorithm and map ordering are pure** → `@clash-tracker/core` (near 100% coverage);
gateway/persistence → `functions` (guarded, emulator/fixture-tested); UI → Vue. Reuse Track 4
eligibility and Track 6 `requireRole('admin')`.

> Implementer note: the auto-plan rules are precise — write the tests for the "every eligible
> player in ≥2 wars" rule AND its "lower-TH-vs-higher-TH override" before implementing. Keep
> strength comparison pluggable (TH now, hero/troop later).

## Phase 1: CWL gateway + mappers

Goal: fetch the league group and the seven wars.

- [ ] Task: Add fixtures: `leaguegroup` JSON and several `clanwarleagues/wars/{warTag}`
  JSONs (different rounds/states, incl. not-in-CWL).
- [ ] Task: Tests + implement pure mappers `mapLeagueGroup` (rounds + war tags) and
  `mapLeagueWar` (rosters, TH levels, attacks) into domain types.
- [ ] Task: Tests + implement `getLeagueGroup(clanTag)` and `getLeagueWar(warTag)` on the
  gateway (same pluggable base URL + typed errors as Track 2). Detect "not in CWL".
- [ ] Verification: all seven rounds map correctly; not-in-CWL detected. [checkpoint]

## Phase 2: Strength metric & map ordering (pure)

Goal: comparable strength + in-game map order.

- [ ] Task: Tests + implement `orderByTownHall(members)` → map order (higher TH first),
  stable for ties. 
- [ ] Task: Tests + implement a pluggable `rosterStrength(members)` interim metric from TH
  levels and `isEqualOrStronger(ours, theirs)`. Structure it so a richer metric can replace
  the TH one without changing callers (higher-order/strategy).
- [ ] Verification: ordering + strength comparison correct. [checkpoint]

## Phase 3: Eligible pool assembly (pure)

Goal: the participant pool with shortage top-up.

- [ ] Task: Tests + implement `buildCwlPool(players, thresholds)` returning eligible
  (above-the-line) players ranked; when fewer than needed, top up from List 2 in ranked
  order until the pool is large enough. Reuse Track 4 functions. Cover the shortage case.
- [ ] Verification: pool correct with and without enough eligible players. [checkpoint]

## Phase 4: Auto-planning algorithm (pure) — the core

Goal: replan remaining wars per the exact product rules.

- [ ] Task: Define inputs/outputs: `planRemainingWars({ pool, remainingWars (each with enemy
  roster), alreadyPlayed })` → placements per war.
- [ ] Task: Tests FIRST for each rule, then implement:
  - each war's roster is **equal or stronger** than its enemy (`isEqualOrStronger`),
  - **every** eligible player placed in **≥2** remaining wars,
  - **override:** if the ≥2 rule would place a lower-TH player opposite an enemy's higher TH,
    the higher-TH player takes that slot instead,
  - within a war, order by TH (Phase 2),
  - deterministic output for fixed inputs.
- [ ] Task: Add adversarial fixtures (tight pools, strong enemies, lopsided TH) and assert
  the override and ≥2 rules interact correctly.
- [ ] Verification: algorithm satisfies all rules across fixtures; near-100% coverage. [checkpoint]

## Phase 5: Persistence + sync status

Goal: store plans and reflect game sync.

- [ ] Task: Emulator tests + implement a `WarPlanRepository` storing the plan per CWL season
  and per war.
- [ ] Task: Tests + implement `computePlanSyncState(storedPlan, gameRosters)` →
  synced/out-of-sync per war and overall (pure).
- [ ] Task: Emulator tests + implement guarded mutations `applyAutoPlan` and `swapPlayer`
  (admin-only) that recompute map order and persist. Assert non-admins rejected.
- [ ] Verification: plans persist; sync state correct after a manual swap. [checkpoint]

## Phase 6: War Plan UI

Goal: the head-to-head view with admin tools.

- [ ] Task: Tests + implement the CWL availability gate: outside CWL show "active only during
  CWL"; no errors.
- [ ] Task: Tests + implement the seven-war layout (mobile-first, scales to desktop) with a
  per-war **head-to-head** pairing of our members vs the enemy in map order, and a visible
  **sync status** indicator.
- [ ] Task: Tests + implement the **unplaced eligible players** list (pool minus placed),
  updating with plan/swaps.
- [ ] Task: Tests + implement admin controls: a swap UI (candidates from the pool) calling
  `swapPlayer`, and an "auto-plan remaining wars" button calling `applyAutoPlan`, both
  behind the admin capability; map re-orders after a swap.
- [ ] Task: Tests + loading/empty/error states; eager-load on swipe to this view.
- [ ] Verification: manual during a (real or fixture) CWL — view the 7 wars, swap a player
  (map re-orders), run auto-plan, see unplaced players and sync status. [checkpoint]

## Done when
- During CWL the view shows all seven wars head-to-head with sync status and unplaced
  eligible players; admins can manually swap (map re-orders by TH) and auto-replan remaining
  wars by an algorithm that provably follows the product rules (equal-or-stronger, ≥2 wars,
  TH override) — all covered by unit + emulator tests, with strength comparison left
  pluggable for future hero/troop refinement.
