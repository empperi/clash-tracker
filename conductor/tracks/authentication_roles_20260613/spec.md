# Spec: Authentication & Roles

**Track:** `authentication_roles_20260613` · **Order:** 6 · **Depends on:** Foundation

## Overview

Add passwordless **magic-link** login for admins/owners, a **secure session cookie** that
persists in the browser, and the **Owner/Admin role** model enforced server-side. The public
site stays fully browsable without login; logging in only unlocks admin/owner capabilities.
This track provides the auth/session/role primitives that Tracks 7 and 8 build their UIs on.

## Background

See `conductor/product.md` → Users / Login and logout, and `tech-stack.md` → Authentication
& sessions. Uses Firebase Auth email-link + Firebase **session cookies** + **custom claims**.
Authorization is enforced in Cloud Functions and Firestore rules — never trusted from the
client.

## Functional Requirements

### FR-1 — Magic-link login
- **Description:** A user enters their username (or email); a sign-in link is emailed; clicking
  it signs them in.
- **Acceptance criteria:**
  - Login is offered only for accounts that exist in `accounts/*` (admins/owners). Unknown
    users get a generic, non-enumerating response.
  - Email-link sign-in completes and establishes a session.
  - Clear states: link sent, link expired/invalid, success.
- **Priority:** High

### FR-2 — Secure session cookie
- **Description:** After link sign-in, the backend mints a Firebase **session cookie**
  (HTTP-only, Secure, SameSite) so the session persists in that browser.
- **Acceptance criteria:**
  - A function exchanges the Firebase ID token for a session cookie; the cookie is
    HTTP-only and not readable by JS.
  - Subsequent requests are authenticated via the cookie; the app shows the username +
    logout instead of the login button.
  - Long-lived per the product (max session-cookie lifetime), refreshed appropriately.
- **Priority:** High

### FR-3 — Logout
- **Description:** Logout clears the session.
- **Acceptance criteria:** a function **clears/revokes** the cookie server-side; the UI
  refreshes to the logged-out state.
- **Priority:** High

### FR-4 — Roles & custom claims
- **Description:** Each account has a role (`owner` | `admin`) mirrored to Firebase **custom
  claims**.
- **Acceptance criteria:**
  - Privileged functions verify the claim server-side; the client never asserts its own role.
  - A composable exposes the current session/role to the UI as a **capability** (e.g.
    `canEditThresholds`, `canViewPastPlayers`, `canManageAccounts`, `isOwner`).
  - Firestore rules updated so server-only collections remain server-only (writes via
    functions); no client gains direct write access.
- **Priority:** High

### FR-5 — Session/account consistency & revocation
- **Description:** A deleted account is logged out immediately and cannot log back in.
- **Acceptance criteria:**
  - Deleting an account **revokes its refresh tokens / sessions**.
  - A request whose session cookie no longer matches a valid account has the cookie
    **cleared** and is redirected to the front page.
  - Tested: revoked session is rejected on the next request.
- **Priority:** High

### FR-6 — Auth-gated function middleware
- **Description:** A reusable guard for callable/HTTP functions enforcing "must be admin" /
  "must be owner".
- **Acceptance criteria:** a higher-order wrapper `requireRole('admin'|'owner')(handler)`
  verifies the session/claim and rejects otherwise; unit-tested with injected token
  verification; reused by Tracks 7/8 and the Track 3 manual trigger.
- **Priority:** High

## Non-Functional Requirements
- **NFR-1 (Security):** No privilege decision trusts client input. Cookies HTTP-only +
  Secure + SameSite. No account enumeration via login. No secrets in logs.
- **NFR-2 (Reliability):** Session checks are stateless-fast; revocation is prompt.
- **NFR-3 (Quality):** ≥80% coverage; pure guard logic unit-tested; flows emulator-tested.

## User Stories
- *As an admin,* I log in by clicking an emailed link and stay logged in on my phone, *so
  that* I don't manage passwords.
- *As the owner,* deleting an admin instantly kicks them out, *so that* access is controlled.
- *As an unauthenticated visitor,* I can still browse everything read-only.

## Technical Considerations
- Keep role/permission mapping pure (`rolesToCapabilities(role)`) and unit-tested; the UI
  consumes capabilities, not raw roles.
- Use the Firebase Auth emulator for flow tests; verify cookie attributes.
- Coordinate Firestore rules changes here (the server-only collections gate accounts/secrets).

## Out of Scope
- The actual admin/owner screens (Tracks 7/8) and inviting/creating accounts (Track 7) and
  the registration view (Track 7). This track delivers the auth/session/role mechanics + the
  login/logout UI in the header.

## Open Questions
- Username vs email at the login prompt — product says "username"; map username→email via
  the `accounts` record. Confirm the lookup is non-enumerating.
