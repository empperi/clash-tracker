# Implementation Plan: Clash of Clans API Integration & Secure Config

Track `clash_api_integration_20260613`. TDD per `conductor/workflow.md`. Pure logic
(codec, mappers, error classification) → `@clash-tracker/core`; I/O (repository, HTTP
gateway) → `functions/`. Inject the encryption key, randomness, and HTTP client.

> Implementer note: repositories are tested against the **Firestore emulator** (real DB),
> not mocks. The gateway is tested with **recorded JSON fixtures**; keep live calls behind
> an env flag.

## Phase 1: Token encryption codec (pure) [checkpoint: 13f46ba]

Goal: safe, reversible token encryption.

- [x] 51f9f59 Task: Write tests for `encryptToken`/`decryptToken` (AES-256-GCM) in `core`: round-trip
  succeeds; tampered ciphertext/authTag → failure `Result`; wrong key → failure; output is
  base64 and contains iv+tag+ciphertext. Inject the IV generator for determinism. Red first.
- [x] 51f9f59 Task: Implement the codec to pass. Use Node `crypto` (available in the functions
  runtime; if `core` must stay runtime-agnostic, define the codec to accept injected
  crypto primitives, or place the codec in `functions/crypto` and keep only the payload
  format type in `core` — choose and note in tech-stack if deviating).
- [x] Verification: round-trip + tamper tests green; coverage ~100%. [checkpoint]

## Phase 2: Secret/config repository (emulator-tested)

Goal: encrypted token + clan tag persisted in Firestore.

- [x] f0eb7ff Task: Write emulator tests for a `SecretsRepository`: `setToken` writes only
  ciphertext (assert the stored field does not equal plaintext); `getDecryptedToken`
  returns the original; `setClanTag`/`getClanTag` round-trip; invalid clan tag rejected.
  Inject the key. Red first (repo not implemented).
- [x] f0eb7ff Task: Implement `SecretsRepository` over `secrets/coc` using the Admin SDK + the
  codec. Make the encryption key an injected dependency (from env in production).
- [x] f0eb7ff Task: Add clan-tag validation (pure, in `core`): must start with `#`, uppercase,
  allowed CoC base32 chars; provide a normalizer. Unit-test.
- [x] Verification: emulator tests pass; confirmed no plaintext token in stored doc. [checkpoint]

## Phase 3: Response mappers (pure)

Goal: raw CoC JSON → internal domain types.

- [ ] Task: Add fixture JSON files (sample `clan`, `currentwar` in several states:
  notInWar, preparation, inWar, warEnded) under a test fixtures dir.
- [ ] Task: Write tests + implement `mapClan(json)` → members with `{ tag, name, role,
  thLevel }` (map CoC role strings → `ClanRole`). Handle missing/unknown fields.
- [ ] Task: Write tests + implement `mapWar(json)` → `War` with opponent, team size, state,
  start/end times, and per-member attacks (`stars`, `destructionPercent`, `order`,
  attacker/defender tags) and defenses. Handle the "no current war" and "preparation"
  states explicitly.
- [ ] Verification: mappers produce correct typed objects for every fixture state. [checkpoint]

## Phase 4: Pluggable CoC API gateway

Goal: authenticated, configurable HTTP access with typed errors.

- [ ] Task: Define a `HttpClient` interface (inject `fetch`-like) and an error
  classification (pure, in `core`): map status → `RateLimited | Unauthorized |
  IpNotWhitelisted | NotFound | Maintenance | Unknown`. Unit-test the classifier.
- [ ] Task: Write tests for `CocApiGateway.getClan`/`getCurrentWar` using a fake
  `HttpClient` returning fixtures: asserts correct URL (base URL from config, `#`→`%23`),
  Authorization header carries the decrypted token, success maps via the mappers, and each
  error status yields the right typed `Result`. Red first.
- [ ] Task: Implement the gateway: read base URL from `COC_API_BASE_URL`, obtain the token
  via `SecretsRepository.getDecryptedToken`, set timeouts, never log the token.
- [ ] Task: Add a **flag-gated** live integration test (`COC_LIVE_TEST=1`) hitting the real
  API for `getClan` to validate end-to-end (skipped by default in CI).
- [ ] Verification: fixture-based tests green; manual live check documented. [checkpoint]

## Phase 5: Seed/bootstrap

Goal: set token + clan tag before the owner UI exists.

- [ ] Task: Add a small seed script (`functions/scripts/seed-secrets.ts` or an emulator
  seed) that, given env `CLASH_TOKEN`/`CLAN_TAG`/`CLASH_TOKEN_ENC_KEY`, writes `secrets/coc`
  via `SecretsRepository`. Test the script's pure parts; document the run command in the
  track README/plan notes.
- [ ] Verification: run the seed against the emulator, then call `getClan` via the gateway
  and confirm a real/typed clan object returns. [checkpoint]

## Done when
- Token is stored encrypted (verified), clan tag configurable, and the gateway fetches clan
  + current war through a configurable base URL with typed error handling — all under tests,
  with the egress choice still pluggable.
