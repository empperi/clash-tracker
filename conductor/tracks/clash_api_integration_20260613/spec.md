# Spec: Clash of Clans API Integration & Secure Config

**Track:** `clash_api_integration_20260613` · **Order:** 2 · **Depends on:** Foundation

## Overview

Build the server-side layer that securely stores the CoC API token and clan tag and talks
to the official API. This is the data lifeline for war tracking. It includes: AES-256-GCM
encryption of the token at rest, a typed config/secret repository, and a **pluggable
`CocApiGateway`** that fetches clan info and the current war. No UI here (the owner UI to set
the token comes in Track 8); for now the token/clan tag are seeded via an emulator seed
script / one-off admin script.

## Background

See `conductor/tech-stack.md` → "CoC API integration", "Secrets & encryption", and the
**deferred egress decision**. All this code lives in `functions/`, with pure helpers (token
codec, response mappers) in `@clash-tracker/core` where they have no I/O.

## Functional Requirements

### FR-1 — Token encryption codec (pure)
- **Description:** Pure functions to encrypt/decrypt the token with AES-256-GCM given a
  32-byte key, producing a self-describing payload (iv + authTag + ciphertext, base64).
- **Acceptance criteria:**
  - `encryptToken(plaintext, key)` → opaque string; `decryptToken(payload, key)` → plaintext.
  - Round-trips correctly; wrong key or tampered payload → a failure `Result`, never a crash
    or a partial/garbage plaintext.
  - Uses a fresh random IV per encryption (inject the IV/randomness so tests are
    deterministic).
- **Priority:** High

### FR-2 — Secret/config repository
- **Description:** A repository wrapping Firestore `secrets/coc` storing the **encrypted**
  token and the (plaintext) clan tag.
- **Acceptance criteria:**
  - `setToken(plaintext)` stores ciphertext only — plaintext token is never written.
  - `getDecryptedToken()` returns the token in memory for gateway use.
  - `setClanTag` / `getClanTag` work; clan tag validated (starts with `#`, allowed chars).
  - Tested against the **Firestore emulator** (real DB). The encryption key is injected.
- **Priority:** High

### FR-3 — Pluggable CoC API gateway
- **Description:** The single module that performs HTTP calls to the CoC API, authenticated
  with the decrypted token, against a **configurable base URL**.
- **Acceptance criteria:**
  - Base URL comes from `COC_API_BASE_URL` (default `https://api.clashofclans.com/v1`); can
    be pointed at a proxy without changing call sites.
  - `getClan(tag)`, `getCurrentWar(tag)` implemented; clan tag URL-encoded (`#`→`%23`).
  - Maps HTTP/network errors (401, 403 IP-not-whitelisted, 404, 429 rate-limit, 503
    maintenance) to typed `Result` errors.
  - The HTTP client is injected, so unit tests use recorded JSON fixtures; a small set of
    live integration tests is gated behind an env flag.
- **Priority:** High

### FR-4 — Response mappers (pure)
- **Description:** Pure functions mapping raw CoC JSON into the internal domain types from
  `@clash-tracker/core` (clan members with role/TH; war with opponent, team size, state,
  per-member attacks/defenses).
- **Acceptance criteria:** given fixture JSON, produce correct typed domain objects; unknown
  enum values handled gracefully; fully unit-tested with no I/O.
- **Priority:** High

### FR-5 — Seed/bootstrap path
- **Description:** A documented way to set the token + clan tag before the owner UI exists.
- **Acceptance criteria:** an emulator seed script (or `firebase functions:shell` snippet)
  sets `secrets/coc`; documented in the track and runnable locally.
- **Priority:** Medium

## Non-Functional Requirements
- **NFR-1 (Security):** Token never logged, never returned to any client, never stored
  unencrypted. Decryption only in function memory.
- **NFR-2 (Resilience):** Respect CoC rate limits; surface 429/maintenance distinctly so
  ingestion can back off. Timeouts on all HTTP calls.
- **NFR-3 (Quality):** ≥80% coverage; codec/mappers ~100%. No `any`.

## User Stories
- *As the owner,* my API token is stored encrypted and never exposed, *so that* it can't
  leak.
- *As the system,* I can fetch the clan and current war reliably, *so that* ingestion has
  data to record.

## Technical Considerations
- Keep the egress decision open: the gateway must not hard-code `api.clashofclans.com`.
- Put pure logic (codec, mappers, error classification) in `core`; keep `functions/`
  adapters thin.
- Consider a tiny in-memory cache/ETag handling later (not required now).

## Out of Scope
- Owner UI for the token/clan tag (Track 8). Persisting wars/attacks (Track 3). Scheduling.

## Open Questions
- Final egress choice (proxy vs Cloud NAT) — see tech-stack deferred decision; gateway stays
  pluggable regardless.
