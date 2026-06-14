# Clash Tracker

A mobile-first PWA for tracking **Clash of Clans** war participation, so our clan can
field a reliable roster for **Clan War Leagues (CWL)**.

Clash Tracker watches the clan's active wars, records every attack (and defense), and
ranks players by how consistently they use their attacks. Players who clear the
participation and attack-rate thresholds qualify for CWL; the rest are clearly flagged
below the line. During CWL it also helps plan the 7 league wars.

> The public site is **freely browsable, read-only**. Logging in (via email magic link)
> unlocks admin and owner controls.

---

## Why this exists

We keep losing wars to **missed attacks**. Clash Tracker makes participation visible and
objective: it tracks every tracked war, computes each player's attack-usage rate and
performance medians, and uses two configurable knobs — **Minimum War Participation** and
**Acceptance Percentage Level** — to decide who is CWL-eligible.

---

## Tech stack (summary)

See [`conductor/tech-stack.md`](conductor/tech-stack.md) for the full rationale.

| Layer | Choice |
|-------|--------|
| Frontend | Vue 3 + TypeScript + Vite (`<script setup>`, Composition API) |
| State / data | Pinia + `@tanstack/vue-query`, repository layer over Firestore |
| Routing / nav | Vue Router + swipe gestures (VueUse `useSwipe`) |
| PWA | `vite-plugin-pwa` (Workbox) |
| Backend | Firebase Cloud Functions (2nd gen, TypeScript, Node 20) |
| Database | Cloud Firestore |
| Auth | Firebase Authentication — email link (passwordless magic link) |
| File storage | Cloud Storage (clan logo) |
| Scheduling | Cloud Scheduler (scheduled functions) for war polling |
| Secrets | AES-256-GCM at rest, key from env / Secret Manager |
| Testing | Vitest + Vue Test Utils / Testing Library, Firebase Emulator Suite |
| Hosting | Firebase Hosting |

### Monorepo layout (npm workspaces)

```
clash-tracker/
├── packages/core/   # Pure domain logic — ranking, medians, war planning. Zero Firebase deps. 100% unit-tested.
├── functions/       # Cloud Functions — CoC API gateway, war ingestion, auth, Firestore repositories.
├── web/             # Vue 3 PWA.
├── conductor/       # Conductor context-driven-development files (product, tech, workflow, tracks).
└── firebase.json    # Firebase project config + emulators.
```

The **`packages/core`** module holds all decision logic (who qualifies, how players are
ordered, how the CWL plan is built) as **pure functions** with no I/O, so it is trivially
unit-testable. Firebase is only touched at the edges (`functions/`, `web/`).

---

## Getting started

> Requires **Node 20+** and the **Firebase CLI** (`npm i -g firebase-tools`).

```bash
# 1. Install all workspace dependencies
npm install

# 2. Start the Firebase emulators (Firestore, Auth, Functions, Storage)
npm run emulators

# 3. In a second terminal, run the web app against the emulators
npm run dev --workspace web

# Run the full test suite (TDD — see conductor/workflow.md)
npm test
```

Firebase project linking lives in `.firebaserc` (replace the placeholder project id with
your own). Secrets (the CoC API token encryption key) are **never** committed — see
[`conductor/tech-stack.md`](conductor/tech-stack.md#secrets--encryption).

---

## Deployment & CI/CD

This is a **single-developer project with no pull requests** — work is pushed straight to
`main`/`master`. GitHub Actions handles testing and deployment:

| Trigger | What runs | Gate |
|---------|-----------|------|
| **Any push** (any branch) | Install → format check → type-check → lint → **full test suite** (unit + Firebase-emulator-backed) | A failing test, lint, or format check fails the workflow |
| **Push a tag matching `release-*`** | Build → `firebase deploy --only hosting,firestore:rules,storage` | **Only deploys if the tests/checks pass** |

### Releasing

To ship to production, push a tag whose name starts with `release-`. The convention is a
timestamp, `release-YYYY-MM-DD-HH-MM`:

```bash
# main/master is green and you want to deploy the current commit:
git tag release-2026-06-13-22-24
git push origin release-2026-06-13-22-24
```

The deploy job **depends on the test job** — if tests fail, **no deploy happens**. A plain
push never deploys; only a `release-*` tag does.

### Required GitHub secrets

Set these in the repo's *Settings → Secrets and variables → Actions* (never commit them):

- `FIREBASE_SERVICE_ACCOUNT_MILITIA_CLASH_TRACKER` — Google Cloud Service Account JSON credentials for `firebase deploy`, created by `firebase github:init` (deprecated `FIREBASE_TOKEN` is not used).
- `CLASH_TOKEN_ENC_KEY` — the AES key for the CoC token (used by functions at runtime, required in Track 2).

> Workflow lives in `.github/workflows/ci.yml`.

---

## How it's built — Conductor

This project is developed with the **Conductor** context-driven-development pattern.
Claude (Opus) designs the specs and plans; a faster model executes the plans under TDD.

- Product vision → [`conductor/product.md`](conductor/product.md)
- UX & code guidelines → [`conductor/product-guidelines.md`](conductor/product-guidelines.md)
- Technology decisions → [`conductor/tech-stack.md`](conductor/tech-stack.md)
- Workflow (TDD, commits) → [`conductor/workflow.md`](conductor/workflow.md)
- Track index → [`conductor/tracks.md`](conductor/tracks.md)

### Build order (tracks)

Tracks are sequenced so the **most valuable capability ships first** — tracking wars and
visualizing who passes the criteria — and the **War Plan / CWL planner comes last**.

1. Foundation, app shell, navigation, PWA, design system
2. Clash API integration & secure config
3. War tracking & ingestion
4. Player stats & ranking domain
5. Player List view
6. Authentication & roles
7. Admin view
8. Owner view
9. War Plan (CWL) — last

Each track lives in `conductor/tracks/<id>/` with a `spec.md`, `plan.md`, and
`metadata.json`.

---

## Core domain rules

**Eligibility** uses two admin-configurable values:

- **Minimum War Participation** (0–20) — splits players into the *qualified-pool list*
  (≥ value wars participated) and the *not-enough-wars list* (below it).
- **Acceptance Percentage Level** (0–100%) — within the first list, draws the line:
  players whose **attack-usage %** is ≥ this value are CWL-eligible (above the line),
  the rest are below it.

**Player ordering** (both lists) is, in priority order:

1. Percentage of attacks done (primary metric)
2. Wars participated
3. Median stars gained per attack
4. Median attacks defended against per war
5. Town Hall level
6. Clan role (Leader → Co-Leader → Elder → Member)

---

## Security posture

- The CoC API token is **long-lived and powerful**: it is stored **encrypted at rest**
  (AES-256-GCM) and **never** sent to the browser.
- Owner/Admin/Unauthenticated roles are enforced in **Firestore Security Rules** and in
  Cloud Functions — never trusted from the client.
- Sessions are stored in a **secure, HTTP-only cookie**; deleting a user immediately
  invalidates their session.

---

## License

Private project for clan use. Not affiliated with or endorsed by Supercell.
