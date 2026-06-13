# Spec: Admin View

**Track:** `admin_view_20260613` · **Order:** 7 · **Depends on:** Player List view, Auth & roles

## Overview

The admin control surface: two **instant-save** sliders for the eligibility thresholds,
**admin account invitations** (with a pending list and revocation), and the **registration
view** opened from an invitation email. All writes go through auth-guarded functions
(`requireRole('admin')`). Changing a threshold instantly re-splits the Player List (Track 5)
because thresholds are inputs to the pure functions.

## Background

See `conductor/product.md` → Admin view and Registration view. Threshold values live in
`publicSettings/config` (public-readable so the list can re-split); invitations live in
`pendingAccounts/*` (server-only). Uses the Track 6 guard + capabilities.

## Functional Requirements

### FR-1 — Acceptance Percentage Level slider (instant save)
- **Description:** Slider 0–100%, 1% increments; saves immediately on change (no Save button).
- **Acceptance criteria:**
  - Admin-only (guarded); persists to `publicSettings/config` via a function on change.
  - Debounced to avoid write storms; shows a subtle saving/saved indicator.
  - Player List re-splits live to the new value.
- **Priority:** High

### FR-2 — Minimum War Participation slider (instant save)
- **Description:** Slider 0–20, increments of 1; saves immediately.
- **Acceptance criteria:** same guard/persist/indicator behavior; List 1 / List 2 membership
  updates live.
- **Priority:** High

### FR-3 — Invite admin
- **Description:** Admin enters an email and submits; a registration email is sent and a
  pending record created.
- **Acceptance criteria:**
  - Guarded function validates the email, creates `pendingAccounts/{id}` with `createdAt`
    and role `admin`, and sends the registration email containing a link to the registration
    view.
  - Duplicate/invalid emails handled gracefully.
- **Priority:** High

### FR-4 — Pending invitations list + revoke
- **Description:** Show all pending invitations; allow revoking (deletes the pending record).
- **Acceptance criteria:** lists `pendingAccounts/*` (via a guarded read function — these are
  server-only); revoke deletes the record; UI updates. Expired ones (>30 min) shown as
  expired or pruned.
- **Priority:** High

### FR-5 — Registration view
- **Description:** Reachable only via an invitation link; collects username + player tag and
  activates the account.
- **Acceptance criteria:**
  - If no matching **pending** account exists → redirect to the front page.
  - If the pending account is **older than 30 minutes** → delete it, then redirect to the
    front page.
  - If valid: user enters **username** and **player tag**; on submit, an account is created
    (role admin), claims set, the pending record removed, and the user is **immediately
    logged in** (session cookie established via Track 6).
  - Player-tag validated/normalized (like clan-tag rules).
- **Priority:** High

## Non-Functional Requirements
- **NFR-1 (Security):** Every write guarded by `requireRole('admin')`; pending/account data
  never client-writable directly. The 30-minute expiry enforced server-side, not by the UI.
- **NFR-2 (UX):** Instant-save feels immediate with clear feedback; sliders are touch-friendly.
- **NFR-3 (Quality):** ≥80% coverage; pure validation/expiry logic unit-tested; flows
  emulator-tested.

## User Stories
- *As an admin,* I nudge the acceptance % and immediately see the Player List line move, *so
  that* I can tune eligibility.
- *As an admin,* I invite a teammate by email and they self-register, *so that* we share the
  load.
- *As an invited user,* clicking my link lets me set my name and tag and I'm instantly in.

## Technical Considerations
- Threshold writes are tiny but frequent — debounce and coalesce.
- The 30-minute expiry should be a **pure** predicate (`isInvitationExpired(createdAt, now)`)
  reused by both the registration flow and the pending-list display; inject `now`.
- Sending email: use Firebase Auth's email-link infrastructure or an email
  provider/extension — keep the sender behind an injected interface for testing.

## Out of Scope
- Owner-only capabilities (Track 8): clan identity, token, clan tag, deleting accounts.
- The auth mechanics themselves (Track 6) — consumed here.

## Open Questions
- Email delivery mechanism (Firebase extension vs provider) — pick one, keep it injectable.
