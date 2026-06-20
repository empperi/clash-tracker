# Spec: Google Sign-In (strict allowlist)

**Track:** `google_sign_in_20260620` · **Order:** 9 · **Depends on:** Authentication & roles,
Admin view

## Overview

Add **Google (OAuth) sign-in** as an alternative to the magic link, so email delivery is no
longer a single point of failure for logging in. The app is **closed-membership**: only an
email that matches an existing **authorized account or pending invitation** may sign in;
everyone else is denied with a neutral message and signed out. Both methods converge on the
Track 6 model — `sessionLogin` → HTTP-only session cookie → `requireRole` — with the role
delivered as a custom claim. Magic-link login remains for anyone who can't or won't use
Google.

## Background

See Track 6 (`authentication_roles_20260613`) → session cookie, `setAccountRole`,
`requireRole`; Track 8 Admin view (`admin_view_20260613`) → admin **invitations** and the
account/registration model the allowlist reuses; `conductor/product.md` → closed membership,
no account enumeration. Roles are **never** trusted from the client.

## Functional Requirements

### FR-1 — Provider & console setup
- **Description:** Enable the Google provider and configure the project for it.
- **Acceptance criteria (documented config, not code):** Google sign-in enabled; OAuth
  consent screen configured; **"one account per email address"** account-linking setting on;
  production domain in Authorized domains. Documented in the track.
- **Priority:** High

### FR-2 — Allowlist decision (pure)
- **Description:** A pure `@clash-tracker/core` helper that decides access from an email and
  the set of authorized accounts/invitations.
- **Acceptance criteria:** given a (case-insensitive) email plus existing accounts and pending
  invitations, returns **allow** (with the account/role to bind) or **deny**. Unit-tested for:
  existing account, valid pending invitation, unknown email, and case-insensitivity.
- **Priority:** High

### FR-3 — Server gating & provisioning
- **Description:** Complete Google sign-in on the server with closed-membership enforcement.
- **Acceptance criteria:**
  - Verify the Google ID token; run the FR-2 decision.
  - **Allowed:** ensure `accounts/{uid}` exists/linked and set the `{ role }` custom claim
    (reuse `setAccountRole`), then issue the session cookie via the Track 6 flow.
  - **Denied:** sign out / revoke and return a **neutral** "not authorized" response (does not
    reveal whether any given email is an admin/owner).
  - Emulator-tested: a member is accepted (claim set, session issued); a non-member is
    rejected (no claim, signed out).
- **Priority:** High

### FR-4 — Client UI
- **Description:** A "Sign in with Google" option in `LoginView`.
- **Acceptance criteria:** button triggers the Google flow; on success the ID token is
  exchanged via the **same** `sessionLogin` endpoint; a rejected (non-member) sign-in shows a
  neutral not-authorized state; the magic-link form remains available. Component tests for the
  success and not-authorized states. Mobile-first, ≥44px touch target.
- **Priority:** High

### FR-5 — Account linking
- **Description:** A user with the same email across Google and magic-link is one account.
- **Acceptance criteria:** with "one account per email" enabled, signing in with Google for
  an email that already has a magic-link identity links to the **same** uid/account — no
  duplicate `accounts` doc, role claim preserved.
- **Priority:** Medium

## Non-Functional Requirements
- **NFR-1 (Security):** Closed membership enforced **server-side**; a non-member can never
  obtain a role. Denial is neutral (no enumeration of who is an admin/owner). Claims are set
  only on the server. Reuses the Track 6 session-cookie + `requireRole` model — no new session
  infrastructure.
- **NFR-2 (Quality):** ≥80% coverage; the allowlist decision is pure and unit-tested; the
  server flow and linking are emulator-tested.

## User Stories
- *As an invited admin,* I click "Sign in with Google" and I'm in with the correct role —
  no email needed.
- *As a random Google user,* I'm cleanly told I'm not authorized, learning nothing about the
  member list.
- *As an admin who used the magic link before,* signing in with Google lands me on the **same**
  account, not a duplicate.

## Technical Considerations
- Reuse `sessionLogin`, `requireRole`, and `setAccountRole` from Track 6; the allowlist reads
  `accounts/*` plus pending invitations from Track 8.
- Firebase "one account per email address" + provider linking nuances
  (`auth/account-exists-with-different-credential`); rely on the linking setting and match by
  email rather than minting parallel accounts.
- Authorized domains must include the OAuth redirect/continue origin.

## Out of Scope
- **Email delivery / Resend** — separate track (`email_delivery_20260620`).
- Other social providers (Apple, GitHub, …).
- Self-service public signup — membership stays closed (invitation/account only).
