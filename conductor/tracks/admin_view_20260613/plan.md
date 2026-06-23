# Implementation Plan: Admin View

Track `admin_view_20260613`. TDD per `conductor/workflow.md`. Pure validation/expiry → `core`;
guarded writes → `functions` (reuse `requireRole('admin')` from Track 6); UI → Vue. Inject
the clock and the email sender for testability.

> Implementer note: enforce the 30-minute expiry **server-side**. Guard every write. The
> thresholds are public-readable (so the list re-splits) but only admins may write them.

## Phase 1: Settings (threshold) functions [checkpoint: 9f5d011]

Goal: persist the two thresholds safely.

- [x] 148f4db Task: Tests + implement pure validators: acceptance % ∈ [0,100] integer; min war
  participation ∈ [0,20] integer. Reject out-of-range.
- [x] 0391aa5 Task: Emulator tests + implement a guarded `setThreshold` function writing to
  `publicSettings/config` (one for each value or a single function with a field arg). Assert
  non-admins are rejected and admins persist; validate inputs.
- [x] 9f5d011 Verification: thresholds persist; public read reflects them. [checkpoint]

## Phase 2: Threshold sliders (instant save) [checkpoint: 1192008]

Goal: touch-friendly sliders that save on change.

- [x] 12a2d71 Task: Tests + implement `AcceptancePercentSlider` (0–100, step 1) and
  `MinWarParticipationSlider` (0–20, step 1): emit on change, debounce, call the settings
  function, show saving/saved indicator. Assert debounce coalesces rapid changes and the
  guard/capability hides them from non-admins.
- [x] 12a2d71 Task: Tests — confirm changing a slider updates `publicSettings/config` and the Player
  List composable re-splits (integration with Track 5 via shared settings query).
- [x] 1192008 Verification: dragging a slider re-draws the qualification line live. [checkpoint]

## Phase 3: Invitations

Goal: invite admins and manage pending invites.

- [x] 8bb19dd Task: Tests + implement pure `isInvitationExpired(createdAt, now)` (>30 min) and an
  email validator. Reuse the expiry predicate later in registration + the pending list.
- [x] f19b890 Task: Emulator tests + implement guarded `inviteAdmin(email)`: validate, create
  `pendingAccounts/{id}` with `createdAt`/role, and send the registration email via an
  injected sender. Assert non-admins rejected; duplicate handled.
- [ ] Task: Emulator tests + implement guarded `listPendingInvites()` and
  `revokeInvite(id)` (delete). Mark/prune expired ones using the predicate.
- [ ] Task: Tests + implement the invite UI (email field + submit) and the pending list with
  revoke buttons + expired indicator. Admin-gated.
- [ ] Verification: invite creates a pending record + email; revoke removes it. [checkpoint]

## Phase 4: Registration view

Goal: self-service activation from the invite link.

- [ ] Task: Tests + implement the registration route guard logic (pure where possible):
  given an invite id + `now`, decide `redirect` (no pending) / `expired` (delete + redirect)
  / `show-form`. Cover all three.
- [ ] Task: Emulator tests + implement `completeRegistration({ inviteId, username,
  playerTag })`: re-check existence + expiry server-side; validate/normalize the player tag;
  create the `accounts` record (role admin), set the custom claim (Track 6 primitive),
  delete the pending record, and establish the session (log the user in). Reject if missing/
  expired.
- [ ] Task: Tests + implement the registration view UI: redirects per the guard; otherwise a
  username + player-tag form; on submit calls `completeRegistration` and lands logged-in.
- [ ] Verification: valid invite → register → logged in as admin; missing/expired → front
  page (and expired pending deleted). [checkpoint]

## Phase 5: Admin view assembly

Goal: bring it together behind the capability.

- [ ] Task: Tests + implement `AdminView.vue` composing the two sliders + invitations
  section, visible only when `canManageAccounts`/admin capability is present; unauthenticated
  users never see it.
- [ ] Verification: manual — admin tunes thresholds (list reacts), invites a user who
  registers and is logged in. [checkpoint]

## Done when
- Admins can adjust both thresholds with instant save (list re-splits live), invite admins
  with a managed pending list, and invited users register via a link with a server-enforced
  30-minute expiry and are logged straight in — all guarded and covered by unit + emulator
  tests.
