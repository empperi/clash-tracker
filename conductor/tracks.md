# Clash Tracker — Tracks

Track index for Conductor. Tracks are sequenced so the **highest-value capability ships
first** (tracking wars and visualizing who passes the criteria) and the **War Plan / CWL
planner is built last**.

Status legend: `[ ]` pending · `[~]` in progress · `[x]` complete.

Each track lives in `conductor/tracks/<id>/` with `spec.md`, `plan.md`, and `metadata.json`.

## Build order & dependencies

| # | Track | Depends on |
|---|-------|-----------|
| 1 | Foundation, app shell, navigation, PWA, design system | — |
| 2 | Clash API integration & secure config | 1 |
| 3 | War tracking & ingestion | 2 |
| 4 | Player stats & ranking domain | 3 |
| 5 | Player List view | 4 |
| 6 | Authentication & roles | 1 |
| 7 | Admin view | 5, 6 |
| 8 | Owner view | 6 (and 2 for token/clan tag) |
| 9 | War Plan (CWL) — last | 5, 7 |

## Tracks

### [ ] Track 1: Foundation, app shell, navigation, PWA, design system [foundation_20260613]
Monorepo + `@clash-tracker/core` + Vue 3 PWA shell with swipe navigation (250ms rule),
Clash-themed design system, and emulator wiring. Placeholder views only.

### [ ] Track 2: Clash API integration & secure config [clash_api_integration_20260613]
AES-256-GCM token encryption at rest, clan-tag config, secrets repository (emulator-tested),
and a pluggable `CocApiGateway` fetching clan + current war with typed error handling.

### [ ] Track 3: War tracking & ingestion [war_ingestion_20260613]
The core. Scheduled polling of the current (classic) war; idempotent, lossless persistence
of wars, members, attacks, defenses; stable identity, diff, and sync-status logic.

### [ ] Track 4: Player stats & ranking domain [player_stats_ranking_20260613]
Pure `@clash-tracker/core` logic: per-player aggregation, attack-usage %, medians, the
two-list participation split, the qualification line, and the six-key ordering comparator;
plus persisting current/past player aggregates.

### [ ] Track 5: Player List view [player_list_view_20260613]
The flagship public view: two ranked lists with an unmistakable qualification line, all
per-player stats, mobile-first layout, and an admin-only lazy infinite-scroll past-players
section. Reads precomputed aggregates; reuses Track 4's pure functions.

### [ ] Track 6: Authentication & roles [authentication_roles_20260613]
Passwordless magic-link login, secure HTTP-only session cookie, Owner/Admin custom claims,
a reusable server-side `requireRole` guard, capability mapping for the UI, and prompt
session revocation. Public site stays read-only browsable.

### [ ] Track 7: Admin view [admin_view_20260613]
Instant-save threshold sliders (acceptance %, min war participation), admin invitations with
a pending list and revocation, and the registration view with a server-enforced 30-minute
expiry. All writes guarded by `requireRole('admin')`.

### [ ] Track 8: Owner view [owner_view_20260613]
Owner-only config: clan name, clan logo (PNG ≤600×600), write-only encrypted CoC API token,
clan tag, and admin/owner account management (delete anyone but yourself, with immediate
session revocation). Guarded by `requireRole('owner')`.

### [ ] Track 9: War Plan (CWL) — last [war_plan_cwl_20260613]
CWL-only view: league group + 7-war fetch, in-game-style head-to-head per war, sync status,
unplaced eligible players, admin manual swaps (map re-orders by TH), and a pure auto-planning
algorithm (equal-or-stronger, every eligible player in ≥2 wars, TH-strength override).
