# Spec: Owner View

**Track:** `owner_view_20260613` · **Order:** 8 · **Depends on:** Auth & roles, Clash API integration

## Overview

The owner-only configuration surface: set the **clan name** shown in the header everywhere,
set the **CoC API token** (write-only, encrypted at rest — never read back), set the **clan
tag**, and **manage admin/owner accounts** (delete anyone except yourself). All writes are
guarded by `requireRole('owner')` and reuse the encryption/config repositories from Track 2
and the auth/revocation primitives from Track 6.

## Background

See `conductor/product.md` → Owner view, and `tech-stack.md` → Secrets & encryption. Clan
name/clanTag are owner-set and (except the token) visible; the token is sacred and
write-only.

## Functional Requirements

### FR-1 — Clan name (explicit Save)
- **Description:** Edit the clan name with a dedicated Save button.
- **Acceptance criteria:** owner-only; persists to `publicSettings/config`; the header
  everywhere reflects the new name after save. Validated (non-empty, length bound).
- **Priority:** High

### FR-2 — CoC API token (write-only, encrypted)
- **Description:** Set/replace the token; it is never shown or loaded into the UI.
- **Acceptance criteria:**
  - A single field + Save; on submit the token is sent to a guarded function that stores it
    **encrypted** via the Track 2 `SecretsRepository` (AES-256-GCM).
  - The token is **never** returned to the client, shown, or logged; the UI only indicates
    whether a token is set, never its value.
- **Priority:** High

### FR-3 — Clan tag (visible, explicit Save)
- **Description:** Set the clan tag used in API calls; it is shown in the UI.
- **Acceptance criteria:** owner-only; validated/normalized (Track 2 clan-tag rules);
  persisted via the secrets/config repo; visible value with a Save button.
- **Priority:** High

### FR-4 — Account management
- **Description:** List all owner/admin accounts (active and pending) and delete any except
  your own.
- **Acceptance criteria:**
  - Owner-only list of `accounts/*` (+ pending from Track 7) via a guarded read function.
  - Delete removes the account and **revokes its sessions** (Track 6), logging that user out
    immediately and preventing re-login.
  - The owner **cannot delete their own account** (guard + UI disable).
- **Priority:** High

## Non-Functional Requirements
- **NFR-1 (Security):** Token never leaves the server unencrypted, never reaches the client,
  never logged. All writes guarded by `requireRole('owner')`. Self-deletion impossible.
- **NFR-2 (Quality):** ≥80% coverage; pure validation unit-tested; flows emulator-tested.

## User Stories
- *As the owner,* I brand the app with our clan name, *so that* it feels like ours.
- *As the owner,* I rotate the API token securely without ever seeing it echoed back.
- *As the owner,* I remove a compromised admin and they're instantly locked out.

## Technical Considerations
- Reuse Track 2 `SecretsRepository` and Track 6 `revokeAccountSessions` / `requireRole`.
- The header reads clan name from `publicSettings/config` (already public) — ensure it
  reacts to changes.

## Out of Scope
- Threshold sliders and admin invites (Track 7). The encryption codec itself (Track 2). War
  Plan (Track 9).
- **Clan logo / image upload** — dropped: a per-clan image only earns its keep once the app
  tracks multiple clans, which is not planned. The header keeps its generic default crest.
