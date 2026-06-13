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
