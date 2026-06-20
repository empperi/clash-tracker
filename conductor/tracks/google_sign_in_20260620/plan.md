# Implementation Plan: Google Sign-In (strict allowlist)

Track `google_sign_in_20260620`. TDD per `conductor/workflow.md`. The allowlist decision is
pure → `@clash-tracker/core` (unit-tested). Server gating/provisioning and account linking →
`functions` against the **emulator** (reuse `sessionLogin` / `setAccountRole` / `requireRole`
from Track 6 and the invitation/account model from Track 8). Never trust a client-asserted
role; enforce closed membership on the server.

> Implementer note: a non-member must never receive a role claim or a session. Denial is
> **neutral** — it must not reveal whether an email belongs to an admin/owner.

## Phase 1: Allowlist decision (pure core)

Goal: one source of truth for "may this email sign in, and as what".

- [ ] Task: Tests + implement a pure `decideGoogleAccess(email, { accounts, invitations })` in
  `core` → `{ allowed: true, uid?, role, bind: 'account' | 'invitation' }` or
  `{ allowed: false }`. Email match is case-insensitive. Cover: existing account, valid
  pending invitation, unknown email, and mixed-case email.
- [ ] Verification: decisions match the closed-membership rules in `spec.md`. [checkpoint]

## Phase 2: Server gating & provisioning (emulator)

Goal: enforce membership and provision the role on sign-in.

- [ ] Task: Emulator tests + implement the Google completion handler: verify the Google ID
  token, apply `decideGoogleAccess`; on allow, ensure `accounts/{uid}` exists/linked and set
  the `{ role }` custom claim via `setAccountRole`, then issue the session cookie (Track 6
  flow); on deny, sign out / revoke and return a neutral "not authorized" response. Inject the
  token verifier so unit paths need no live Auth. Assert: member accepted (claim + session),
  non-member rejected (no claim, signed out), neutral denial message.
- [ ] Verification: server enforces closed membership; non-members get no role; denial leaks
  nothing. [checkpoint]

## Phase 3: Client UI & account linking

Goal: a usable Google button that reuses the existing session flow, with no duplicate accounts.

- [ ] Task: Tests + add "Sign in with Google" to `LoginView`: success → exchange the ID token
  via `sessionLogin`; non-member rejection → neutral not-authorized state; the magic-link form
  stays available. Mobile-first, ≥44px target. Component tests for both states.
- [ ] Task: Tests + handle same-email linking (Google + prior magic-link identity → one uid /
  one `accounts` doc, role preserved), relying on the "one account per email" setting.
- [ ] Verification: an invited admin signs in via Google end-to-end with the correct role; a
  non-member is denied neutrally; magic-link login is unaffected; no duplicate accounts.
  [checkpoint]

## Done when
- Authorized admins/owners can sign in with Google **or** the magic link, both ending in the
  same secure session with the correct role; non-members are cleanly and neutrally denied; a
  shared email maps to a single account — all covered by unit + emulator tests.
