# Implementation Plan: Owner View

Track `owner_view_20260613`. TDD per `conductor/workflow.md`. Reuse Track 2
(`SecretsRepository`, clan-tag rules) and Track 6 (`requireRole('owner')`,
`revokeAccountSessions`). Pure validation → `core`; guarded writes → `functions`; UI → Vue.

> Implementer note: the token is write-only — never return it to the client or log it. The
> owner must never be able to delete themselves.

## Phase 1: Clan identity (name + clan tag) [checkpoint: 7608a74]

Goal: owner-set, header-visible identity.

- [x] ee72623 Task: Tests + implement pure validators: clan name (non-empty, max length); clan tag
  (reuse Track 2 normalizer/validator).
- [x] 745b5ab Task: Emulator tests + implement guarded `setClanName` and `setClanTag` functions
  (owner-only) writing to `publicSettings/config` / secrets-config. Assert non-owners
  rejected.
- [x] de071cf Task: Tests + implement the name + clan-tag fields with **explicit Save** buttons and
  validation feedback; ensure the header reflects the saved name (reads
  `publicSettings/config`).
- [x] Verification: changing name/clan tag updates the header everywhere after save. [checkpoint]

## Phase 2: CoC API token (write-only) [checkpoint: d1d5348]

Goal: securely set/replace the token.

- [x] e0a953d Task: Emulator tests + implement a guarded `setApiToken(token)` function storing it
  encrypted via `SecretsRepository`. Assert: stored value is ciphertext (≠ plaintext), the
  function returns no token, and nothing logs the token.
- [x] d1d5348 Task: Tests + implement the token field + Save: write-only input, a "token is set"
  indicator (boolean from a guarded status function — never the value), success feedback.
- [x] Verification: set a token; confirm encryption at rest and that the UI never receives
  it; the gateway (Track 2) can then authenticate. [checkpoint]

## Phase 3: Account management

Goal: list and delete accounts safely.

- [x] c125b3d Task: Emulator tests + implement a guarded `listAccounts()` returning active +
  pending accounts (no secrets) for owners only.
- [x] 2f70cb9 Task: Tests + implement pure `canDeleteAccount(targetUid, currentOwnerUid)` →
  false when target == self. 
- [x] c125b3d Task: Emulator tests + implement guarded `deleteAccount(uid)`: refuse self-deletion,
  delete the account, and call `revokeAccountSessions(uid)` so the user is logged out and
  cannot re-login. Cover the self-delete rejection.
- [x] 835052a Task: Tests + implement the accounts list UI with delete buttons (own account's delete
  disabled), reflecting active/pending status.
- [x] Verification: deleting an admin logs them out immediately; self-delete blocked in UI
  and server. [checkpoint]

## Phase 4: Owner view assembly

Goal: compose behind the owner capability.

- [x] 835052a Task: Tests + implement `OwnerView.vue` composing identity, token, clan tag, and
  account management, visible only when `isOwner`. Non-owners (incl. plain admins) never see
  it.
- [x] Verification: manual — full owner flow: brand the app, rotate the token, manage
  accounts. [checkpoint]

## Done when
- The owner can set clan name/clan tag (header reflects them), securely set a write-only
  encrypted token that never reaches the client, and manage accounts (deleting anyone but
  themselves, with immediate session revocation) — all owner-guarded and covered by unit +
  emulator tests.
