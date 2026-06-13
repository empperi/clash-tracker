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

