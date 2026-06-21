# Clash Tracker

A mobile-first PWA that tracks **Clash of Clans** war participation so our clan can field a
reliable **Clan War League (CWL)** roster. It watches active wars, records every attack and
defense, and ranks players by how consistently they use their attacks — drawing a clear
qualification line. During CWL it also helps plan the seven league wars.

> The public site is **freely browsable and read-only**. Logging in (passwordless — a 6‑digit
> code or magic link emailed to known accounts) unlocks admin and owner controls.

For the product vision, domain rules, and architecture rationale, see the
[`conductor/`](conductor/) docs ([product](conductor/product.md) ·
[tech-stack](conductor/tech-stack.md) · [workflow](conductor/workflow.md)).

---

## Development environment

Everything below runs **entirely against the Firebase Emulator Suite** — no real Firebase
project, no real Clash API token, and no real email provider are needed for local work.

### Prerequisites

- **Node 22+** (Cloud Functions target Node 22) and npm.
- **Firebase CLI** — `npm i -g firebase-tools`.
- **Java 21+** — required by the Firestore/Auth emulators.

### 1. Install

```bash
npm install            # installs every workspace (packages/core, functions, web)
```

### 2. One-time local secret setup (`functions/.secret.local`)

The auth functions bind Secret Manager secrets (`RESEND_API_KEY`, `OTP_PEPPER`,
`RESEND_SENDER`). Without local values, the emulator tries to reach the **live** Secret
Manager API under the fake `demo-clash-tracker` project and spams warnings. Provide dummy
values once:

```bash
cp functions/.secret.local.example functions/.secret.local
```

The example ships `=dummy` for all three. `dummy` satisfies the emulator's presence check
**and** makes the mailer fall back to the **console mailer** (which prints the OTP code +
magic link to the terminal — see [logging in locally](#5-logging-in-locally)). `.secret.local`
is git-ignored; never put a real key there.

### 3. Run the app

Two terminals:

```bash
# Terminal 1 — Firebase emulators (Firestore, Auth, Functions, Storage, Hosting)
npm run emulators            # or: npm run emulators:seed  (see "Seeding data")

# Terminal 2 — Vue PWA against the emulators
npm run dev                  # alias for: npm run dev --workspace web
```

The app serves at **http://localhost:5173**. In dev mode the web app auto-connects to the
emulators (no `.env` needed — `web/src/firebase-setup.ts` defaults `VITE_USE_EMULATORS` on).

| Service | URL / Port |
|---------|-----------|
| Web dev server (Vite) | http://localhost:5173 |
| Emulator UI | http://localhost:4000 |
| Functions | :5001 |
| Firestore | :8080 |
| Auth | :9099 |
| Storage | :9199 |
| Hosting (built app) | :5000 |

### 4. Seeding data

A fresh emulator is empty — no players, no accounts. Two ways to get data in:

**a) Persistent snapshot (`.seed/`).** Start the emulators with import + export-on-exit so
your local data survives restarts:

```bash
npm run emulators:seed       # --import=./.seed --export-on-exit=./.seed
```

On shutdown (Ctrl‑C) the current emulator state — Firestore docs, Auth users, Storage — is
written back to `./.seed`. The `.seed/` directory is **git-ignored** (it's a local dump, not
source). If you don't have a `.seed` yet, create one by seeding (below) and exiting once.

**b) Re-seed from scripts.** With the emulators running, populate mock players, thresholds,
and two login-capable accounts:

```bash
npx tsx functions/scripts/seed-mock-players.ts
```

This writes mock current/past players, default thresholds (70% acceptance / 5 wars), and
seeds **two accounts with Auth users + role claims**:

| Login email | Role | Display name |
|-------------|------|--------------|
| `admin@example.internal` | admin | ChiefAdmin |
| `owner@example.internal` | owner | ChiefOwner |

It is idempotent (docs keyed by tag). To seed the encrypted **CoC API token + clan tag** into
Firestore (only needed to exercise real ingestion), see
[`functions/README.md`](functions/README.md) → `seed-secrets.ts`.

### 5. Logging in locally

There is no real email in dev — the **console mailer** prints the code and link. To sign in:

1. Make sure you've seeded accounts (step 4) and the emulators + dev server are running.
2. Open **http://localhost:5173/login** and enter a seeded email, e.g. `admin@example.internal`.
3. Click **Send Magic Link**, then watch the **emulators terminal** for a line like:

   ```
   [MAILER] Sent OTP code 597167 and sign-in link to admin@example.internal: http://127.0.0.1:9099/emulator/action?mode=signIn&...
   ```

4. Type that **6‑digit code** into the "Check your email" screen and hit **Verify & Sign In**.
   You'll be signed in (custom token → session cookie) and redirected home with the role's UI.

> The magic link in the same log line also works if you paste it into the browser — but the
> 6‑digit code is the simplest path and mirrors production. The code is single-use, expires in
> 10 minutes, and is attempt-capped (5).

### 6. Tests, lint, build

```bash
npm test                 # all workspaces. Repository/auth tests need the emulators running.
npm run test:emulator    # spins up the emulators, runs the suite, tears them down (CI-equivalent)
npm run lint             # ESLint across workspaces
npm run typecheck        # tsc / vue-tsc, no emit
npm run format:check     # Prettier
npm run build            # build every workspace (web build also type-checks + emits the PWA)
```

Use `CI=true` to make watch-mode tools run once. TDD is mandatory — see
[`conductor/workflow.md`](conductor/workflow.md).

> **Why repo tests need the emulator:** repositories are tested against a **real** Firestore
> emulator (no mocking libraries) per the project's functional-architecture rules. Either keep
> `npm run emulators` running and use `npm test`, or use the all-in-one `npm run test:emulator`.

---

## Tech stack (summary)

| Layer | Choice |
|-------|--------|
| Frontend | Vue 3 + TypeScript + Vite (`<script setup>`, Composition API) |
| State / data | Pinia + `@tanstack/vue-query`, repository layer over Firestore |
| Routing / nav | Vue Router + swipe gestures (VueUse `useSwipe`) |
| PWA | `vite-plugin-pwa` (Workbox); opportunistic manifest link-handling |
| Backend | Firebase Cloud Functions (2nd gen, TypeScript, **Node 22**) |
| Database | Cloud Firestore |
| Auth | Firebase Auth — passwordless: 6‑digit one-time code (preferred) + magic link |
| Email | Resend (prod) behind a `Mailer` interface; console mailer in dev/emulator |
| File storage | Cloud Storage (clan logo) |
| Scheduling | Cloud Scheduler (scheduled functions) for war polling |
| Secrets | AES-256-GCM token at rest; keys/peppers in Secret Manager, never client-bound |
| Testing | Vitest + Vue Test Utils / Testing Library, Firebase Emulator Suite |
| Hosting | Firebase Hosting |

### Monorepo layout (npm workspaces)

```
clash-tracker/
├── packages/core/   # Pure domain logic — ranking, medians, eligibility, OTP predicates. Zero Firebase deps.
├── functions/       # Cloud Functions — CoC gateway, war ingestion, auth/OTP, mailer, Firestore repositories.
├── web/             # Vue 3 PWA.
├── conductor/       # Conductor context-driven-development files (product, tech, workflow, tracks).
└── firebase.json    # Firebase project config + emulator ports.
```

All decision logic (who qualifies, player ordering, CWL planning, OTP format/expiry) lives in
**`packages/core`** as **pure functions** with no I/O. Firebase is touched only at the edges
(`functions/`, `web/`).

---

## Deployment & CI/CD

Single-developer project, no pull requests — work is pushed straight to `main`. GitHub Actions
(`.github/workflows/ci.yml`) handles testing and deployment:

| Trigger | What runs | Gate |
|---------|-----------|------|
| **Any push** (any branch) | Install → format check → type-check → lint → **full test suite** (unit + emulator) | A failing check fails the workflow |
| **Push a tag `release-*`** | Build → `firebase deploy` | **Only deploys if the checks pass** |

### Releasing

Push a tag whose name starts with `release-` (convention: `release-YYYY-MM-DD-HH-MM`):

```bash
git tag release-2026-06-21-22-24
git push origin release-2026-06-21-22-24
```

The deploy job depends on the test job — if tests fail, nothing deploys. A plain push never
deploys.

### Production secrets & config

**Firebase Secret Manager** (set with `firebase functions:secrets:set <NAME>`), required for
real sign-in email:

- `RESEND_API_KEY` — Resend API key. If unset/`dummy` in production the mailer **throws loudly**
  rather than silently failing.
- `OTP_PEPPER` — server pepper mixed into OTP hashing. Also **fails loud** if unset or `dummy`
  in production, so the publicly-known placeholder can never hash real codes.
- `RESEND_SENDER` — the `From` address/name for sign-in emails.
- `CLASH_TOKEN_ENC_KEY` — AES key for the CoC token (used by ingestion functions).

**GitHub Actions secrets** (*Settings → Secrets and variables → Actions*):

- `FIREBASE_SERVICE_ACCOUNT_MILITIA_CLASH_TRACKER` — service-account JSON for `firebase deploy`
  (from `firebase github:init`).

**Firebase web config (public, not secret):** a production hosting build needs the
`VITE_FIREBASE_*` values present when `npm run build` runs (see [`web/.env.example`](web/.env.example)).
The web apiKey only identifies the project, so set these as plain GitHub Actions **variables**.

---

## Build order (Conductor tracks)

Developed with the **Conductor** pattern: Claude (Opus) authors specs/plans; a faster model
executes them under TDD. Tracks are sequenced so the **most valuable capability ships first**
and the **CWL planner comes last**. Status lives in [`conductor/tracks.md`](conductor/tracks.md).

1. Foundation, app shell, navigation, PWA, design system
2. Clash API integration & secure config
3. War tracking & ingestion
4. Player stats & ranking domain
5. Player List view
6. Authentication & roles
7. Email delivery & one-time-code sign-in
8. Admin view
9. Google sign-in (strict allowlist)
10. Owner view
11. War Plan (CWL) — last

Each track lives in `conductor/tracks/<id>/` with a `spec.md`, `plan.md`, and `metadata.json`.

---

## Core domain rules

**Eligibility** uses two admin-configurable values:

- **Minimum War Participation** (0–20) — splits players into the *qualified pool*
  (≥ value wars participated) and the *not-enough-wars* list.
- **Acceptance Percentage Level** (0–100%) — within the pool, players whose **attack-usage %**
  is ≥ this value are CWL-eligible (above the line); the rest fall below it.

**Player ordering** (both lists), in priority order:

1. Percentage of attacks done (primary metric)
2. Wars participated
3. Median stars gained per attack
4. Median attacks defended against per war
5. Town Hall level
6. Clan role (Leader → Co-Leader → Elder → Member)

---

## Security posture

- The CoC API token is long-lived and powerful: stored **encrypted at rest** (AES-256-GCM) and
  **never** sent to the browser.
- Sign-in is **non-enumerating**: send/verify responses are opaque regardless of whether an
  account exists. OTPs are CSPRNG-generated, hashed with a server pepper, compared in constant
  time, single-use, short-lived (10 min), attempt-capped (5), and never logged. The
  `pendingLogins` collection is server-only.
- Owner/Admin/Unauthenticated roles are enforced in **Firestore Security Rules** and Cloud
  Functions — never trusted from the client.
- Sessions live in a **secure, HTTP-only cookie**; deleting a user immediately invalidates
  their session.

---

## License

Private project for clan use. Not affiliated with or endorsed by Supercell.
