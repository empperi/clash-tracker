# Spec: Player List View

**Track:** `player_list_view_20260613` · **Order:** 5 · **Depends on:** Player stats & ranking

## Overview

The flagship public view: render current clan members in **two ranked lists** with an
unmistakable **qualification line**, showing every per-player stat from `product.md`. It
reads precomputed aggregates from `players/*` and applies the (live) thresholds via
`@clash-tracker/core`. Includes the admin-only **past-players** toggle with lazy,
infinitely-scrolling load. This is what most users open the app to see.

## Background

See `conductor/product.md` → Player List view, and `product-guidelines.md` (mobile-first,
the qualification line must not rely on color alone). All ordering/eligibility comes from
Track 4's pure functions — this track does **not** re-derive domain rules.

## Functional Requirements

### FR-1 — Data loading
- **Description:** Load current players and the two thresholds (from `publicSettings/config`)
  via `@tanstack/vue-query`.
- **Acceptance criteria:** explicit loading / empty / error states; cached and deduped;
  read-only (no writes). Eager-load on swipe start (per Track 1).
- **Priority:** High

### FR-2 — Two lists + qualification line
- **Description:** Render List 1 (qualified pool) and List 2 (not enough wars), each ordered
  by the six-key comparator; within List 1 draw the divider between above/below the line.
- **Acceptance criteria:**
  - Lists and line computed via the Track 4 functions using the loaded thresholds.
  - A clear **visual divider** plus a **subtle but distinct** styling for above-the-line
    (qualified) players — and an icon/label so it's not color-only.
  - Re-splits instantly if thresholds change (they're inputs), no raw-stat refetch needed.
- **Priority:** High

### FR-3 — Player row stats
- **Description:** Each row shows: name, clan role, TH level, wars participated, attacks
  done, **% attacks done**, median destruction %, median stars, median attacks defended,
  median own-base destruction.
- **Acceptance criteria:** mobile-legible (scannable numbers, units `%`/`★`); role shown
  with the game's terminology; works at ~360px; row is an accessible list item.
- **Priority:** High

### FR-4 — Mobile-first layout
- **Description:** A compact, scannable layout for phones with progressive disclosure for
  the many stats (e.g. primary stats always visible, secondary on expand) and a richer
  layout on desktop.
- **Acceptance criteria:** no horizontal scrolling on mobile; touch targets ≥44px; readable
  density; same components scale up on desktop.
- **Priority:** High

### FR-5 — Admin past-players toggle (lazy + infinite scroll)
- **Description:** When logged in as admin/owner, a toggle reveals a third section of
  players who have left, ordered by most recent leaver first.
- **Acceptance criteria:**
  - Hidden/disabled for unauthenticated users.
  - Data loaded **only when toggled** (not before).
  - Infinite scroll / pagination (uses the Track 4 `getPastPlayers` query + index); shows
    the same stats and ordering, with the extra recency ordering.
  - Loading more appends without reflowing the page jarringly.
- **Priority:** Medium (admin gating depends on Track 6; until then, build the toggle behind
  a capability flag and wire real auth when available)

## Non-Functional Requirements
- **NFR-1 (Perf):** Reads precomputed aggregates; initial render fast on mobile; past-players
  paginated.
- **NFR-2 (A11y):** WCAG AA; qualification conveyed by more than color; keyboard navigable.
- **NFR-3 (Quality):** Component tests for each state; ≥80% coverage.

## User Stories
- *As a clan member,* I open the app and immediately see who's above the CWL line and where I
  stand, *so that* I know if I qualify.
- *As an admin,* I can reveal players who left and review their record, *so that* I have full
  context.

## Technical Considerations
- Keep the view presentational; put the split/sort in a composable that calls `core`.
- The qualification styling must remain legible on the themed background (AA contrast).
- Past-players section must not load any data until the toggle is on.

## Out of Scope
- Editing thresholds (Track 7). Auth itself (Track 6) — consume its capability/state when
  ready. War-related views (Track 9).

## Open Questions
- Exact progressive-disclosure pattern (expandable row vs detail sheet) — choose the most
  mobile-friendly; keep all stats reachable.
