# Tech Stack: Clash Tracker

The deliberate technology choices for Clash Tracker. Per the workflow, **changes to this
file must be made before** the corresponding implementation, with a dated note.

## At a glance

| Concern | Choice | Why |
|---------|--------|-----|
| Language | **TypeScript** (strict) everywhere | One language across web + functions + domain; strong types catch errors before tests. |
| Frontend framework | **Vue 3 + Vite** (`<script setup>`, Composition API) | Built-in transitions suit the swipe animation; composables fit the functional style; great PWA tooling. |
| Client state | **Pinia** + **@tanstack/vue-query** | Pinia for small UI/session state; vue-query for cached, deduped Firestore reads with loading/error states. |
| Navigation | **Vue Router** + **VueUse** (`useSwipe`) | Routed views with custom swipe gestures and the 250ms physics rule. |
| Styling | **Scoped SFC styles + global CSS custom properties** | Clash theme tokens in one place; no heavy CSS framework needed. (Tailwind optional, not required.) |
| PWA | **vite-plugin-pwa** (Workbox) | Manifest, service worker, offline caching of read-only data. |
| Backend | **Firebase Cloud Functions** (2nd gen, Node 20, TS) | Serverless; the only place the CoC token is decrypted and used. |
| Database | **Cloud Firestore** | Real-time, scales to zero, simple security rules; document model fits players/wars. |
| Auth | **Firebase Authentication — Email Link (passwordless)** | Native magic-link login exactly as specified. |
| File storage | **Cloud Storage for Firebase** | Clan logo PNG (≤600×600). |
| Scheduling | **Scheduled Cloud Functions** (Cloud Scheduler) | Periodic war polling/ingestion. |
| Hosting | **Firebase Hosting** | Serves the PWA; `/api/**` rewrites to functions. |
| Secrets | **Cloud Functions secrets / env + AES-256-GCM** | Token encrypted at rest, key never in code. |
| Testing | **Vitest**, **Vue Test Utils** + **@testing-library/vue**, **Firebase Emulator Suite**, optional **Playwright** E2E | Fast unit tests; emulator for real repository/integration tests; no mocks for Firestore. |
| Tooling | **npm workspaces**, **ESLint + Prettier**, **vue-tsc** | Monorepo, consistent style, type-checking. |

Runtime baseline: **Node 20** (see `.nvmrc`).

## Monorepo structure

```
packages/core/   @clash-tracker/core    Pure domain logic. No Firebase, no I/O. 100% unit-tested.
functions/       @clash-tracker/functions  Cloud Functions: CoC gateway, ingestion, auth, repositories.
web/             @clash-tracker/web     Vue 3 PWA.
```

**`packages/core` is the heart.** All decision logic lives here as **pure functions** over
plain data:

- eligibility (which list a player is on, above/below the line),
- player ordering (the 6-key comparator),
- stat aggregation (attack-usage %, medians for destruction/stars/defenses),
- the CWL planning algorithm.

`functions/` and `web/` import these. Because `core` has no I/O, the rules that matter most
are testable with plain inputs and outputs — no emulator, no mocks.

## Functional architecture (testability)

This codebase follows **functional programming principles**: pure functions, no shared
mutable state, higher-order functions and closures where they clarify intent.

- **Pure core, impure edges.** Side effects (Firestore, network, clock, randomness) live
  only in `functions/` and `web/` adapters. Domain logic receives data and returns data.
- **Dependency injection by function, not by mock.** A use case takes its collaborators as
  function parameters (e.g. `(deps) => async (input) => ...`), so tests pass real or
  in-memory implementations instead of mocking frameworks.
- **Repository layer wraps Firestore.** Repositories are the *only* code that talks to
  Firestore. Per the workflow, **repository tests run against the Firestore emulator**
  (real database), not mocks. Everything above the repository is unit-tested with
  in-memory data.
- **Time and identifiers are injected.** Pass `now: Date` and id generators in, so pure
  logic stays deterministic and testable.
- **`Result<T, E>` over thrown control-flow.** Prefer returning typed results for
  expected/validation failures; reserve exceptions for truly exceptional cases.

## CoC API integration

- All access goes through a single **`CocApiGateway`** in `functions/` — the only module
  that reads the decrypted token and performs HTTP calls. Everything else depends on a
  typed interface, so it can be exercised with recorded fixtures in unit tests and hit the
  real API only in a few integration tests.
- Endpoints used:
  - `GET /clans/{clanTag}` — clan + member list (name, role, TH).
  - `GET /clans/{clanTag}/currentwar` — active classic war.
  - `GET /clans/{clanTag}/currentwar/leaguegroup` — CWL group (built last).
  - `GET /clanwarleagues/wars/{warTag}` — individual CWL war (built last).
- `clanTag` must be URL-encoded (the leading `#` → `%23`).

### ⚠️ Open decision — API egress IP (deferred)

The CoC API **requires whitelisting the static IP** that calls it, but Cloud Functions
have **dynamic egress IPs**. The gateway is therefore built with a **configurable base URL**
(`COC_API_BASE_URL`) so the egress strategy can be chosen/changed without touching call
sites. Options:

1. **Proxy with a fixed IP** (e.g. `https://proxy.royaleapi.dev/v1`) — whitelist the
   proxy's IP once; zero infra. Simplest, but relies on a third party.
2. **Cloud NAT + reserved static IP** via a VPC connector — fully self-hosted; small
   monthly cost and extra GCP networking config.

**Action for the API-integration track:** keep the gateway base URL injectable and document
which option is active. Do **not** hard-code `api.clashofclans.com`.

## Secrets & encryption

- The CoC API token is stored **encrypted at rest** in Firestore (`secrets/coc`), using
  **AES-256-GCM** (Node `crypto`). The 32-byte key comes from an environment
  variable / Cloud Functions secret (`CLASH_TOKEN_ENC_KEY`), **never committed**.
- Decryption happens **only in memory inside functions**, immediately before an API call.
- The token is **never** written to logs, returned to any client, or placed in a
  client-readable Firestore document. The owner UI can *set* it but never *read* it back.
- The clan tag is stored alongside but may be shown in the UI (it is not secret).
- **Note (2026-06-14):** To keep `@clash-tracker/core` completely runtime-agnostic and avoid importing Node-specific type definitions (like `Buffer` or `node:crypto`) in the browser context, the encryption codec implementation lives in the `@clash-tracker/functions` package, not in `core`.

## Authentication & sessions

- **Firebase Auth Email Link** sends the magic link. On click, the user is signed in.
- The app then establishes a **secure, HTTP-only session cookie** (Firebase **session
  cookie**) via a function, so the session persists in that browser. Logout calls a
  function that **revokes/clears** the cookie.
- **Roles** (`owner` / `admin`) are stored in the `accounts` collection and mirrored as
  **custom claims**. Every privileged function verifies the claim server-side; clients
  never assert their own role.
- Deleting an account **revokes its sessions immediately**; a stale cookie that no longer
  matches the database is cleared and the user is redirected to the front page.

## Data model (Firestore)

> Read-only collections are world-readable; server-only collections are written exclusively
> via the Admin SDK. See `firestore.rules`.

| Collection | Visibility | Contents |
|------------|------------|----------|
| `players/{playerTag}` | public read | Current/past member: name, role, THlevel, `inClan`, aggregate stats (warsParticipated, attacksDone, attackUsagePct, median destruction/stars/defenses), `lastWarParticipatedAt`. |
| `wars/{warId}` | public read | One tracked war: type (classic/cwl), opponent, start/end times, team size, sync status. |
| `wars/{warId}/attacks/{attackId}` | public read | Each attack: attacker tag, defender tag, stars, destruction %, order. |
| `wars/{warId}/members/{memberTag}` | public read | Per-war roster: attacks used/available, defenses faced, own-base destruction. |
| `publicSettings/config` | public read | Clan name, logo URL, Acceptance Percentage Level, Minimum War Participation. |
| `secrets/coc` | server only | Encrypted token, clan tag. |
| `accounts/{uid}` | server only | Owner/admin accounts: email, role, username, playerTag. |
| `pendingAccounts/{id}` | server only | Invitations awaiting registration (with createdAt for the 30-min expiry). |

Aggregate player stats are **recomputed by `@clash-tracker/core`** after each ingestion and
written to `players/*`, so the public Player List is a cheap read.

## Testing strategy

- **Unit tests (most):** all of `@clash-tracker/core`; pure logic in functions/web. Plain
  inputs/outputs, deterministic, no I/O. Vitest.
- **Repository / integration tests (where it makes sense):** repositories run against the
  **Firestore emulator**; the CoC gateway tested with recorded JSON fixtures, plus a thin
  layer of live integration checks gated behind a flag.
- **Component tests:** Vue components with Vue Test Utils / Testing Library, asserting
  rendered states (loading/empty/error, the qualification line).
- **E2E (optional):** Playwright against the emulator suite for the critical flows
  (browse Player List, magic-link login).
- **Coverage target: 80%** (see `workflow.md`). `core` should be near 100%.

## CI/CD (GitHub Actions)

Single developer, **no pull requests** — pushes go straight to `main`/`master`. Set up in
Track 1 (Foundation). See `README.md` → "Deployment & CI/CD" for the developer-facing summary.

- **CI on every push (any branch):** install → typecheck (`vue-tsc`, `tsc`) → lint →
  `npm test` (run under the **Firebase Emulator Suite** so repository tests work, e.g.
  `firebase emulators:exec "npm test"`). A failing test fails the workflow.
- **Deploy on `release-*` tags** (e.g. `release-2026-06-13-22-24`): build → `firebase deploy`
  (hosting + functions + rules). The deploy job **`needs:` the test job** — it only runs when
  tests pass; a plain push never deploys.
- Auth via `FIREBASE_SERVICE_ACCOUNT`/`FIREBASE_TOKEN` GitHub secret; `CLASH_TOKEN_ENC_KEY`
  and runtime config are GitHub secrets, never committed.
