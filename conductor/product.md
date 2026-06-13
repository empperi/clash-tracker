# Product Guide: Clash Tracker

## Vision

Clash Tracker is a mobile-first PWA that makes **Clash of Clans war participation
objective and visible**, so our clan can field a dependable roster for **Clan War Leagues
(CWL)** and stop losing wars to missed attacks.

It tracks the clan's active wars, records every attack and defense, computes per-player
performance, and ranks members by how reliably they use their attacks. Two configurable
thresholds decide who is CWL-eligible. During CWL it also helps plan the seven league wars.

## The problem

Our clan wants to do well in CWL, but we keep **losing wars because members miss
attacks**. Today there is no shared, trustworthy record of who actually participates and
who doesn't — decisions about CWL rosters are based on memory and gut feeling.

Clash Tracker replaces that with data: every tracked war contributes to each player's
participation history, and the app draws a clear line between players who have earned a
CWL spot and those who haven't.

## Target users

| User | Description | Needs |
|------|-------------|-------|
| **Clan members (unauthenticated)** | Anyone with the link. No login. | See where they (and others) stand: attack rate, wars participated, whether they're above the CWL line. Read-only. |
| **Admins** | Trusted clan officers. | Tune the eligibility thresholds, run/adjust the CWL plan, see players who have left, invite other admins. |
| **Owner** | Clan leader / app owner. | Everything admins can do, plus configure clan identity (name, logo), the CoC API token (secret), the clan tag, and manage admin accounts. |

> The public site is **freely browsable and read-only**. Login (email magic link) is only
> for admins/owners and only unlocks write/admin capabilities.

## Key features

1. **War tracking & ingestion** *(highest priority)* — periodically poll the clan's active
   war from the official CoC API and durably record wars, attacks, and defenses.
2. **Player List & CWL eligibility visualization** *(highest priority)* — two ranked lists
   of current members with a clear, visual "above/below the line" qualification indicator.
3. **Configurable eligibility** — Acceptance Percentage Level (0–100%) and Minimum War
   Participation (0–20), adjusted by admins and applied instantly.
4. **Authentication & roles** — passwordless magic-link login; Unauthenticated / Admin /
   Owner permission tiers.
5. **Admin tools** — threshold sliders, admin invitations, registration flow.
6. **Owner tools** — clan name, clan logo, encrypted CoC API token, clan tag, account
   management.
7. **War Plan (CWL)** *(last to build)* — head-to-head visualization of the seven CWL
   wars, manual player swaps, and an automatic re-planning algorithm.

## Core domain rules

### Eligibility (two knobs)

- **Minimum War Participation** splits members into two lists:
  - **List 1 — qualified pool:** participated in **≥** Minimum War Participation tracked wars.
  - **List 2 — not enough wars:** everyone below that.
- **Acceptance Percentage Level** draws a line **inside List 1**: members whose
  **attack-usage %** is **≥** the level are **CWL-eligible (above the line)**; the rest are
  **below the line**. The visual distinction must make qualification obvious at a glance.

### Player ordering (both lists, in priority order)

1. **Percentage of attacks done** — the single most important metric.
2. Wars participated.
3. Median stars gained per attack.
4. Median attacks defended against per war.
5. Town Hall (TH) level.
6. Clan role (Leader → Co-Leader → Elder → Member).

### Per-player stats (over all tracked wars)

Name, clan role, TH level, wars participated, attacks done, **% of attacks done**
(the inverse of missed attacks), median destruction % per attack, median stars per
attack, median attacks-defended-against per war, median own-base destruction during
defenses per war.

### CWL planning (built last)

- Pull the seven CWL wars from the league group endpoint.
- Only **eligible** players are considered, unless there aren't enough — then fill the pool
  by taking players in order from List 2.
- For each war, build a roster **equal to or stronger** than the enemy. Spread players so
  every eligible player gets into **at least two** wars — *unless* honoring that would put
  a lower TH against an enemy's higher TH, in which case the stronger player takes the slot.
- Map order is by TH level initially (higher THs first); later refined by hero/equipment/
  troop levels.

## Success metrics

- **Fewer missed attacks** in tracked wars over time (the north-star outcome).
- Every current member appears with an accurate, up-to-date attack-usage %.
- CWL rosters are drawn from above-the-line players; war losses to no-shows trend down.
- The active war's tracked state stays in sync with the game (clearly indicated when it
  isn't).

## Out of scope (for now)

- Recruiting / clan-discovery features.
- Non-war statistics (donations, trophies, clan games).
- Push notifications and reminders to individual players.
- Multi-clan support — Clash Tracker tracks **one** clan (the configured clan tag).

## Guiding principles

- **Mobile first, always.** Clash of Clans is a phone game; Clash Tracker must feel native
  on a phone and installable as a PWA. Desktop must work too, but never at mobile's expense.
- **Read-only by default.** The data is public to the clan; only admins/owners change anything.
- **The token is sacred.** The CoC API token is long-lived and powerful — encrypted at
  rest, never sent to the browser, never logged.
- **Truthful data.** The app should clearly state when its view of a war is or isn't synced
  with the game.
