# Implementation Plan: Player List View

Track `player_list_view_20260613`. TDD per `conductor/workflow.md`. Vue components are
**presentational**; the split/sort live in a composable over `@clash-tracker/core`. Test
rendered states (loading/empty/error, the line) with Vue Test Utils / Testing Library.

> Implementer note: do NOT re-implement ordering or eligibility here — import the Track 4
> functions. The qualification line must be obvious AND not color-only.

## Phase 1: Data composable [checkpoint: 48505db]

Goal: load players + thresholds with proper states.

- [x] e3ca153 Task: Tests + implement `usePlayers()` (vue-query): fetches current players from
  `players/*` and thresholds from `publicSettings/config`; exposes `isLoading`/`isError`/
  data. Inject the repository/fetcher so tests use in-memory data (no live Firestore).
- [x] 5e5e028 Task: Tests + implement `usePlayerLists(players, thresholds)` calling
  `splitByParticipation`, `markQualification`, and `sortPlayers` from `core`, returning
  `{ qualifiedAbove, qualifiedBelow, notEnoughWars }`. Pure-ish; recomputes when thresholds
  change.
- [x] Verification: composables return correct lists for fixture data. [checkpoint: 48505db]

## Phase 2: Player row & stats [checkpoint: 657d2a9]

Goal: an accessible, mobile-legible row.

- [x] 18a00ff Task: Tests + implement `PlayerRow.vue` showing all required stats (name, role, TH,
  wars, attacks done, % done, median destruction/stars/defenses/own-destruction). Assert the
  values render and the row is a semantic list item with a ≥44px target.
- [x] bc513de Task: Tests + implement progressive disclosure (primary stats visible; secondary via
  expand or detail sheet). Assert secondary stats are reachable and accessible.
- [x] Verification: row reviewed at 360px; numbers scannable. [checkpoint: 657d2a9]

## Phase 3: Lists & qualification line

Goal: the two lists with the divider.

- [ ] Task: Tests + implement a `QualificationLine` divider component (visible separator +
  label/icon). Assert it renders between above/below groups.
- [ ] Task: Tests + implement `PlayerListView.vue`: renders List 1 (above-line group, line,
  below-line group) and List 2, each ordered via the composable. Assert above-line players
  carry the qualified styling AND an icon/label (not color-only), and ordering matches.
- [ ] Task: Tests + implement loading / empty / error states for the view.
- [ ] Verification: with fixture data, the line splits correctly and re-splits when
  thresholds change. [checkpoint]

## Phase 4: Admin past-players (lazy + infinite scroll)

Goal: leavers section, loaded only when toggled.

- [ ] Task: Tests + implement a capability flag `canViewPastPlayers` (from session/auth state
  — inject it; real wiring arrives with Track 6). Toggle hidden when false.
- [ ] Task: Tests + implement `usePastPlayers()` with paginated fetch (cursor over
  `getPastPlayers`, ordered by `lastWarParticipatedAt` desc). Assert it does **not** fetch
  until enabled, and fetches the next page on demand.
- [ ] Task: Tests + implement the past-players section with infinite scroll (IntersectionObserver
  or sentinel; inject the observer for testability). Appends pages; same row component.
- [ ] Verification: toggle reveals leavers, scrolling loads more, nothing loads before toggle. [checkpoint]

## Phase 5: Polish & integration

Goal: production-ready view.

- [ ] Task: Apply theme tokens; verify AA contrast for the qualified styling on the themed
  background. Ensure desktop layout enhancement.
- [ ] Task: Wire eager-load: trigger `usePlayers` fetch as the swipe toward this view begins
  (hook into Track 1's swipe-start). Test the trigger.
- [ ] Verification: manual on mobile + desktop — lists, line, stats, past-players all correct
  and accessible. [checkpoint]

## Done when
- The Player List shows both ranked lists with an unmistakable, non-color-only qualification
  line and all required stats, re-splits live on threshold changes, and offers an admin-only
  lazy, infinite-scroll past-players section — all reading from precomputed aggregates and
  Track 4's pure functions, with component tests for every state.
