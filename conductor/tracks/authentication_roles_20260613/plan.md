# Implementation Plan: Authentication & Roles

Track `authentication_roles_20260613`. TDD per `conductor/workflow.md`. Pure role/permission
and guard logic → `core`/`functions` pure helpers (unit-tested); flows → emulator
(Auth + Firestore). Never trust client-asserted roles.

> Implementer note: security-critical. Verify cookie attributes (HTTP-only/Secure/SameSite)
> and that revocation actually blocks the next request. No account enumeration.

## Phase 1: Roles → capabilities (pure) [checkpoint: 9b486cd]

Goal: a single source of truth for what each role can do.

- [x] f1f8753 Task: Tests + implement `rolesToCapabilities(role)` in `core` → `{ canEditThresholds,
  canViewPastPlayers, canManageAccounts, canEditClanIdentity, canSetToken, isOwner, ... }`.
  Owner is a superset of admin. Cover both roles and "unauthenticated" (all false).
- [x] Verification: capability mapping matches `product.md` permission tables. [checkpoint]

## Phase 2: Session cookie & logout (emulator)

Goal: secure session lifecycle.

- [ ] Task: Emulator tests + implement a `sessionLogin` function exchanging a verified
  Firebase ID token for a **session cookie** (HTTP-only, Secure, SameSite). Assert cookie
  attributes and that a subsequent request authenticates.
- [ ] Task: Emulator tests + implement `sessionLogout` clearing/revoking the cookie; assert
  the next request is unauthenticated.
- [ ] Verification: login sets a valid HTTP-only cookie; logout clears it. [checkpoint]

## Phase 3: Magic-link login UI + account lookup

Goal: passwordless sign-in for known accounts only.

- [ ] Task: Tests + implement a non-enumerating `findAccountForLogin(usernameOrEmail)` that
  resolves to an account email only if it exists; returns a uniform response either way
  (no leak). Unit-test the non-enumeration.
- [ ] Task: Tests + implement the email-link send + completion flow (Firebase Auth email
  link) wired to the lookup; on completion call `sessionLogin`. Component/flow tests with
  the Auth emulator. UI states: sent / invalid-or-expired / success.
- [ ] Task: Tests + implement header login/logout UI: shows a login entry when logged out;
  shows username + logout when logged in (driven by the session composable).
- [ ] Verification: a seeded admin can request a link, sign in, and see their username. [checkpoint]

## Phase 4: Custom claims & server-side guard

Goal: enforce roles on the server.

- [ ] Task: Tests + implement claim syncing: when an account's role is set, mirror it to a
  Firebase **custom claim**. (Account creation itself is Track 7; here provide the
  `setAccountRole` primitive + test.)
- [ ] Task: Tests + implement `requireRole(role)(handler)` higher-order guard: verifies the
  session cookie + claim, rejecting unauthorized callers with 401/403. Inject the token
  verifier so unit tests need no live Auth. Reused by Tracks 3/7/8.
- [ ] Task: Tests + implement a `useSession()` composable exposing `{ user, role,
  capabilities }` from the session, and wire it to the Track 5 `canViewPastPlayers` flag.
- [ ] Verification: guarded function rejects non-admins, accepts admins; UI capabilities
  reflect role. [checkpoint]

## Phase 5: Revocation & consistency

Goal: deleting/invalidating an account ends access immediately.

- [ ] Task: Tests + implement `revokeAccountSessions(uid)` (revoke refresh tokens) used when
  an account is deleted. Emulator test: after revoke, the next authenticated request fails.
- [ ] Task: Tests + implement middleware that, when a session cookie no longer matches a
  valid account, **clears the cookie** and signals a redirect to the front page. Cover the
  stale-cookie case.
- [ ] Verification: revoked/deleted account is locked out on the next request and redirected. [checkpoint]

## Phase 6: Firestore rules hardening

Goal: rules consistent with the role model.

- [ ] Task: Update `firestore.rules` so `accounts`/`pendingAccounts`/`secrets` stay
  server-only and the public read collections remain read-only; add rules tests (emulator
  `@firebase/rules-unit-testing`) proving unauthenticated and admin clients cannot write
  protected docs directly (writes go through functions).
- [ ] Verification: rules tests green; no client write path to protected data. [checkpoint]

## Done when
- Admins/owners log in via magic link, persist via a secure session cookie, log out cleanly;
  roles are enforced server-side via claims + a reusable guard; deleting/invalidating an
  account immediately ends access; and the public site remains fully browsable read-only —
  all covered by unit + emulator tests.
