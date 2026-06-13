# Spec: Player Stats & Ranking Domain

**Track:** `player_stats_ranking_20260613` · **Order:** 4 · **Depends on:** War ingestion

## Overview

Turn the recorded war data into the per-player numbers and ordering that drive the whole
product. This is almost entirely **pure logic in `@clash-tracker/core`** — aggregation,
medians, the attack-usage %, the two-list split, the qualification line, and the six-key
comparator — plus a function that recomputes `players/*` aggregates after ingestion. Getting
this right is "visualizing who passes the criteria," the second-highest product priority.

## Background

See `conductor/product.md` → "Core domain rules" for the exact stats, ordering keys, and
eligibility semantics. The Player List UI (Track 5) is a thin renderer over this domain.

## Functional Requirements

### FR-1 — Per-player aggregation (pure)
- **Description:** From a player's per-war records (across all tracked wars), compute the
  aggregate stats.
- **Acceptance criteria:** computes, per player:
  - **wars participated** (wars where the player was on the roster),
  - **attacks done** and **attacks available** across those wars,
  - **attack-usage %** = attacksDone / attacksAvailable × 100 (define behavior when
    available = 0 → 0%); rounded per a documented rule,
  - **median destruction %** per attack (over all attacks done),
  - **median stars** per attack,
  - **median attacks defended against** per war,
  - **median own-base destruction** during defenses per war,
  - **lastWarParticipatedAt** timestamp.
  - Fully unit-tested incl. empty/edge inputs.
- **Priority:** High

### FR-2 — Median helper (pure)
- **Description:** A correct, reusable `median` for number arrays.
- **Acceptance criteria:** odd/even length, single element, empty (define → 0 or null per
  documented choice) all covered; does not mutate input. Unit-tested.
- **Priority:** High

### FR-3 — Eligibility split (pure)
- **Description:** Given players + the two thresholds, split into the two lists and mark the
  qualification line.
- **Acceptance criteria:**
  - **List 1 (qualified pool):** `warsParticipated >= minWarParticipation`.
  - **List 2:** the rest.
  - Within List 1, each player flagged `aboveLine = attackUsagePct >= acceptancePct`.
  - Boundary values (exactly equal) count as **qualified / above** (`>=`).
  - Pure; thresholds injected; unit-tested at boundaries.
- **Priority:** High

### FR-4 — Player ordering (pure comparator)
- **Description:** The six-key sort applied to both lists.
- **Acceptance criteria:** orders by, in priority: (1) attack-usage % desc, (2) wars
  participated desc, (3) median stars desc, (4) median attacks-defended desc, (5) TH level
  desc, (6) clan role (Leader→Co-Leader→Elder→Member). Stable, total ordering; built from
  composable key-extractors (higher-order). Unit-tested incl. tie-break chains.
- **Priority:** High

### FR-5 — Recompute & persist aggregates
- **Description:** After ingestion, recompute all current players' aggregates and write
  `players/*` so the public list is a cheap read.
- **Acceptance criteria:**
  - `makeRecomputePlayerStats({ warRepo, playerRepo })` reads tracked wars, computes
    aggregates via the pure functions, and upserts player docs (including `inClan`, role, TH
    from the latest clan fetch).
  - Players who have left are marked `inClan=false` but retained (for the admin past-players
    list).
  - Emulator-tested for the persistence; the computation itself unit-tested in `core`.
- **Priority:** High

### FR-6 — Past vs current partition
- **Description:** Provide queries/helpers distinguishing current members from those who
  left, ordered for the admin past-players list (most recent leaver first).
- **Acceptance criteria:** a repository query returns past players ordered by
  `lastWarParticipatedAt` desc (uses the composite index already defined); current players
  filtered by `inClan=true`. Emulator-tested.
- **Priority:** Medium

## Non-Functional Requirements
- **NFR-1 (Correctness):** Stats and ordering exactly match `product.md`. This is the
  product's credibility — near-100% coverage on the pure functions.
- **NFR-2 (Perf):** Aggregates are precomputed; the public list read is O(players).
- **NFR-3 (Quality):** Pure, immutable, no `any`.

## User Stories
- *As a clan member,* my attack-usage % and medians reflect every tracked war accurately,
  *so that* the ranking is fair.
- *As an admin,* the two lists and the qualification line update the moment thresholds
  change (thresholds are inputs to pure functions).

## Technical Considerations
- Keep thresholds as **inputs**, not baked in — Track 7 changes them live, and the UI must
  re-split without a recompute of raw stats.
- Define and document rounding and the divide-by-zero rules once; reuse everywhere.

## Out of Scope
- Rendering the lists (Track 5). Threshold-editing UI (Track 7). CWL-specific logic (Track 9).

## Open Questions
- Rounding of attack-usage % (integer vs one decimal) — pick one, document, keep consistent
  with the slider's 1% increments.
