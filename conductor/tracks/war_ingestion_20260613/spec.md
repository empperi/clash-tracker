# Spec: War Tracking & Ingestion

**Track:** `war_ingestion_20260613` · **Order:** 3 · **Depends on:** Clash API integration

## Overview

The core of Clash Tracker: durably record every classic war the clan fights. A scheduled
function periodically polls the current war via the gateway, and an **idempotent ingestion**
use case writes/updates the war, its members, attacks, and defenses in Firestore — without
duplicating data across repeated polls. It also maintains the war's **sync status** (does
our stored snapshot match the game's current state). This is the data that every stat and
ranking later depends on.

## Background

See `conductor/product.md` (war tracking is highest priority) and `tech-stack.md` data
model (`wars/{warId}`, `.../members`, `.../attacks`). CWL wars are **out of scope here** —
this track handles classic wars; CWL ingestion is part of Track 9. Pure decisions
(identity, diff, sync state) live in `@clash-tracker/core`; persistence in `functions/`.

## Functional Requirements

### FR-1 — Stable war identity (pure)
- **Description:** Derive a deterministic `warId` from a war so repeated polls map to the
  same document.
- **Acceptance criteria:** given a mapped `War`, produce a stable id (e.g. from clan tag +
  opponent tag + preparationStartTime). Same war across polls → same id; a new war → new id.
  Unit-tested.
- **Priority:** High

### FR-2 — Idempotent ingestion (pure decision + repository write)
- **Description:** Given the freshly fetched war and the currently stored war, compute the
  set of new/changed records to write (new attacks, updated member tallies, war state
  changes) so re-polling doesn't duplicate or lose data.
- **Acceptance criteria:**
  - Pure `diffWar(stored, fetched)` returns attacks to add (by stable attack identity),
    member updates, and the new war header/state — never re-adding existing attacks.
  - Applying the diff twice produces the same result as applying it once (idempotent).
  - Attacks are uniquely identified (e.g. attacker tag + defender tag + order/round) so the
    same attack is never stored twice.
  - Unit-tested with fixtures across war states (preparation → inWar → warEnded).
- **Priority:** High

### FR-3 — Sync status
- **Description:** Track whether the stored war matches the game's current snapshot.
- **Acceptance criteria:** `computeSyncState(stored, fetched)` → `'synced' | 'out-of-sync'`
  (pure). On successful ingestion of the latest fetch, the war is `synced`; if a fetch fails
  or is stale, the war is flagged accordingly with a `lastSyncedAt` timestamp. Unit-tested.
- **Priority:** High

### FR-4 — War / member / attack repositories (emulator-tested)
- **Description:** Repositories that persist the war header, per-member war records, and
  attacks/defenses.
- **Acceptance criteria:**
  - Write a full war on first ingest; apply incremental diffs on later ingests.
  - Reads return typed domain objects.
  - Tested against the **Firestore emulator**; verify no duplicate attacks after repeated
    ingestion of the same fetch.
- **Priority:** High

### FR-5 — Scheduled ingestion function
- **Description:** A scheduled Cloud Function that runs the ingestion use case on an
  interval (e.g. every 15–30 min), with back-off on rate-limit/maintenance.
- **Acceptance criteria:**
  - Reads clan tag from config, calls `getCurrentWar`, runs ingestion, updates sync status.
  - On `notInWar`/preparation-only, does nothing harmful (no empty war stored).
  - On 429/maintenance, logs and exits cleanly without corrupting state (no token logged).
  - The schedule handler is a thin wrapper over the (tested) pure use case + repositories.
- **Priority:** High

### FR-6 — Manual ingestion trigger (admin-callable, internal)
- **Description:** An on-demand callable to force an ingestion now (used later by admin UI /
  for testing).
- **Acceptance criteria:** an authenticated callable function runs the same use case once
  and returns the resulting sync status. (Auth wiring lands with Track 6; for now it can be
  emulator/internal-only.)
- **Priority:** Medium

## Non-Functional Requirements
- **NFR-1 (Correctness):** Ingestion is idempotent and lossless — the canonical record of
  attacks must never double-count or drop attacks.
- **NFR-2 (Resilience):** Transient API failures don't corrupt stored wars; back-off on rate
  limits.
- **NFR-3 (Security):** No token in logs; only public-safe war data stored in public
  collections.
- **NFR-4 (Quality):** ≥80% coverage; pure ingestion logic ~100%.

## User Stories
- *As a clan member,* every war we fight is recorded accurately, *so that* my participation
  is counted fairly.
- *As an admin,* I can trust the stored attack history is complete and not duplicated.

## Technical Considerations
- A war "completes" when state becomes `warEnded`; ensure the final snapshot is captured
  even if the war ends between polls (final poll after end time).
- Store enough per-member data for Track 4 stats: attacks used/available, defenses faced,
  own-base destruction during defenses.
- Keep all branching decisions pure and tested; the scheduled function should contain almost
  no logic.

## Out of Scope
- CWL war ingestion (Track 9). Computing aggregate player stats/medians (Track 4). Any UI.

## Open Questions
- Poll interval and whether to increase frequency near war end — start with a fixed interval,
  revisit. Note any change in `tech-stack.md`.
