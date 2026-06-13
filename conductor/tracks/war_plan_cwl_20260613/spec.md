# Spec: War Plan (CWL)

**Track:** `war_plan_cwl_20260613` · **Order:** 9 (last) · **Depends on:** Player List, Admin view

## Overview

The CWL planner, built last. Active only during Clan War League: pull the league group and
its seven wars, render each as an in-game-style **head-to-head** map of our members vs the
enemy, show clearly whether the plan is **synced** with the game, list **unplaced eligible
players**, and give admins two tools — **manual player swaps** (with map re-ordering) and an
**automatic re-planning algorithm** for all remaining wars. The planning algorithm is pure
logic in `@clash-tracker/core`.

## Background

See `conductor/product.md` → War Plan view and "CWL planning". Eligibility comes from Track 4;
the participant pool is above-the-line players, topped up from List 2 when too few. CWL data
comes from the gateway endpoints (Track 2 extended here): `currentwar/leaguegroup` and
`clanwarleagues/wars/{warTag}`.

## Functional Requirements

### FR-1 — CWL availability gate
- **Description:** The view works only during CWL.
- **Acceptance criteria:** outside CWL it shows a clear "active only during CWL" message; no
  errors. Detected from the league group endpoint state.
- **Priority:** High

### FR-2 — League group + 7 wars fetch
- **Description:** Extend the gateway to fetch the league group and each war tag.
- **Acceptance criteria:** `getLeagueGroup(clanTag)` and `getLeagueWar(warTag)` implemented
  with the same pluggable base URL + typed errors; mapped to domain types (pure mappers,
  fixture-tested). All seven rounds retrievable.
- **Priority:** High

### FR-3 — Seven-war layout + head-to-head
- **Description:** Show all 7 CWL wars, each with our roster vs the enemy, ordered like the
  in-game map.
- **Acceptance criteria:**
  - Mobile-first layout that also works well on desktop (you choose the layout).
  - Per war: head-to-head pairing of our members against their opposite numbers, mirroring
    the game's map order.
  - Clear **sync status** per war/plan ("synced to game" vs "out of sync").
- **Priority:** High

### FR-4 — Unplaced eligible players
- **Description:** List eligible players currently not placed in any war.
- **Acceptance criteria:** computed from the eligible pool minus placed players; clearly
  shown; updates as swaps/plan change.
- **Priority:** High

### FR-5 — Manual swap (admin) + map re-order
- **Description:** Admins swap a player for a specific war from the eligible pool; the map
  order recalculates.
- **Acceptance criteria:**
  - Swap candidates come from eligible players (above the line; topped up from List 2 if
    needed — same rule as auto-plan).
  - After a swap, the map order is recomputed by **TH level** (higher TH first) — the
    documented initial rule (hero/equipment/troop refinement is future work).
  - Guarded by `requireRole('admin')`; the plan persists; sync status reflects divergence
    from the game until applied there.
- **Priority:** High

### FR-6 — Automatic re-planning algorithm (pure)
- **Description:** Replan all **remaining** wars from the eligible pool.
- **Acceptance criteria (encode exactly from product.md):**
  - Consider only eligible (above-the-line) players, **unless** there aren't enough — then
    fill from List 2 in ranked order until the pool is large enough.
  - For each war, build a roster **equal to or stronger** than the enemy.
  - Distribute players across remaining wars so **every** eligible player is placed in **at
    least two** wars — **unless** honoring that would put a lower-TH player against an
    enemy's higher TH, in which case the higher-TH player takes that slot instead.
  - Map order within a war by TH level (higher first), as in FR-5.
  - Pure, deterministic given inputs; thoroughly unit-tested incl. the shortage and
    TH-override cases.
- **Priority:** High

### FR-7 — Apply / persist plan
- **Description:** Persist the plan and reflect sync state.
- **Acceptance criteria:** plans stored (per CWL season); the view shows whether the stored
  plan matches the game's current rosters; admins can re-run auto-plan or tweak manually.
- **Priority:** Medium

## Non-Functional Requirements
- **NFR-1 (Correctness):** The planning algorithm exactly follows the product rules,
  including the "≥2 wars" rule and its TH-strength override.
- **NFR-2 (UX):** Head-to-head reads clearly on mobile; sync status is always visible.
- **NFR-3 (Security):** Admin-guarded mutations; reads public-safe.
- **NFR-4 (Quality):** ≥80% coverage; the algorithm near 100%.

## User Stories
- *As an admin during CWL,* I auto-generate a balanced plan for the remaining wars and then
  fine-tune by swapping players, *so that* we field strong, fair rosters.
- *As a clan member,* I see who I'm matched against in each war, *so that* I know my target.

## Technical Considerations
- "Equal or stronger than the enemy" needs a comparable strength metric — start with TH
  level (sum/sorted comparison), structured so hero/equipment/troop levels can refine it
  later without rewriting call sites.
- Keep the algorithm pure: inputs = eligible pool (ranked), enemy rosters per remaining war,
  already-played wars; output = proposed placements. No I/O inside.
- CWL ingestion of actual attacks can reuse Track 3's idempotent approach if desired (war
  tracking during CWL) — coordinate identity so CWL wars also count toward stats.

## Out of Scope (future)
- Hero/equipment/troop-level strength refinement (explicitly later).
- Cross-season analytics.

## Open Questions
- Strength comparison precision for "equal or stronger" beyond TH — define a clear interim
  metric and document it; leave hooks for the richer model.
