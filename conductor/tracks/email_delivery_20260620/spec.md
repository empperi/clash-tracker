# Spec: Email Delivery & One-Time-Code Sign-In

**Track:** `email_delivery_20260620` · **Order:** 7 · **Depends on:** Authentication & roles

## Overview

Make passwordless sign-in actually work in production **and** make it robust for the installed
PWA. Two problems are solved together because they share the same send path:

1. **Delivery.** Track 6 generates the sign-in link server-side (Admin SDK
   `generateSignInWithEmailLink`) and hands it to an injected `Mailer`, but the only
   implementation is `consoleMailer`, which just logs the link — so no email reaches a user and
   **production login is impossible**. This track adds a real `Mailer` backed by **Twilio
   SendGrid**, with the API key held as a Firebase secret (never logged, never sent to the
   client).

2. **The PWA cross-context gap.** A magic link clicked in an email opens in whatever browser the
   OS routes it to. If that is not the same browser/storage container the PWA runs in (common on
   iOS home-screen PWAs, and whenever the default browser differs), the session cookie is set in
   the wrong place and the PWA stays logged out. To make sign-in reliable from inside the PWA we
   add a **6-digit one-time code (OTP)** that the user reads from the email and types back into
   the **same PWA they already have open** — so the app both initiates and completes the flow,
   with no browser-routing dependency. The magic link stays as a secondary convenience.

So every sign-in email now carries **both**: a prominent OTP (the preferred path) and the
existing magic link below it (fallback / desktop convenience). On platforms that support it, a
**Web App Manifest link-handling** declaration lets the installed PWA capture the magic-link URL
and open in-app, avoiding the copy-paste entirely.

## Background

See Track 6 (`authentication_roles_20260613`) → `findAccountForLogin` / `handleFindAccountForLogin`
/ `Mailer` (`functions/src/auth.ts`) and `sessionLogin`, and `conductor/product.md`: login is for
**known accounts only**, sent server-side, with **no account enumeration**. This track preserves
all of that. The non-enumerating lookup and the link generation are unchanged; we **add** an OTP
alongside the link, a verification endpoint that converges on the existing `sessionLogin` cookie
path, real delivery, and a manifest hint.

## Functional Requirements

### FR-1 — One-time code: generation & verification logic
- **Description:** A cryptographically-random 6-digit numeric code with server-side verification
  logic. Pure decision logic (format, expiry, attempt-cap predicates) lives in
  `@clash-tracker/core`; code generation and hashing live in `functions/` (server-only crypto).
- **Acceptance criteria:**
  - Generation draws from a CSPRNG (inject the randomness source so tests are deterministic);
    output is always 6 digits including leading zeros.
  - The code is **hashed at rest** (SHA-256 over code + a server-side pepper + the account uid);
    plaintext is never stored. Verification uses a **constant-time** comparison.
  - Pure predicates cover: valid format, expired (`now` vs `expiresAt`), and attempts-exceeded.
  - **Priority:** High

### FR-2 — Pending-login store & send integration
- **Description:** When a known account requests sign-in, generate the OTP **in addition to** the
  magic link, persist the hashed code, and email both. Reuses Track 6's non-enumerating lookup.
- **Acceptance criteria:**
  - On a known account: a `pendingLogins/{uid}` doc is written with the **hashed** code,
    `expiresAt` (single, short TTL — 10 min), and `attempts: 0`; both the code and the link are
    handed to the mailer. On an unknown account: nothing is written and nothing is sent
    (non-enumeration preserved; opaque `{ status: 'ok' }` either way).
  - A fresh request **replaces** any prior pending code for that account (one live code at a time).
  - `pendingLogins` is **server-only** in `firestore.rules` (deny all client read/write, like
    `accounts`/`pendingAccounts`), with a rules test proving it.
  - **Priority:** High

### FR-3 — OTP verification endpoint → session
- **Description:** A callable `verifyLoginOtp(usernameOrEmail, code)` that verifies the code and,
  on success, returns a **Firebase custom token** the client exchanges for a session via the
  existing `sessionLogin` path.
- **Acceptance criteria:**
  - Resolves the account with the same non-enumerating lookup, loads `pendingLogins/{uid}`,
    constant-time-compares the hash, and checks expiry + attempt cap.
  - **Success:** deletes the pending doc (single-use) and returns a custom token for that uid.
  - **Failure** (no account / wrong code / expired / too many attempts): increments `attempts`
    when a pending doc exists, invalidates the code once the cap (5) is hit, and returns a
    **uniform** "invalid or expired code" error that does not reveal account existence.
  - The minted custom token, when signed in client-side, yields an ID token whose `auth_time` is
    fresh, so the existing `sessionLogin` (account-exists + 5-min freshness checks) accepts it
    unchanged. No new session/cookie mechanism is introduced.
  - **Priority:** High

### FR-4 — SendGrid `Mailer` implementation
- **Description:** Implement the `Mailer` using SendGrid's mail-send API, with the HTTP transport,
  API key, and sender identity injected as dependencies (functional-first; no live network calls
  in tests).
- **Acceptance criteria:**
  - Given a fake transport, produces a well-formed request: correct endpoint + `Bearer` auth,
    `to` = recipient, `from` = configured sender, a subject, and a body containing **both** the
    OTP and the sign-in link.
  - Maps a non-2xx response / transport failure to a typed `Result` error; the caller can react
    without throwing raw provider errors.
  - The API key and the OTP are **never logged** (success or error paths).
  - **Priority:** High

### FR-5 — Secret & configuration
- **Description:** Hold the SendGrid API key, the server-side OTP pepper, and the sender address
  as server-read configuration via **Firebase secrets** (`defineSecret`).
- **Acceptance criteria:** secrets are read only server-side, bound to the sending/verifying
  functions; never reach the client, never logged. A missing/unset key fails the send with a
  clear server error (link + code are still generated, but delivery fails loudly, not silently).
  Console/secret setup is documented.
- **Priority:** High

### FR-6 — Dev vs. prod mailer selection
- **Description:** Use the SendGrid mailer when configured (production); keep `consoleMailer` for
  the emulator/dev (no key required) — logging both the code and the link.
- **Acceptance criteria:** selection is explicit and tested — configured ⇒ SendGrid, unconfigured
  ⇒ console. Local dev / emulator behaviour is unchanged in spirit (now logs code **and** link).
- **Priority:** High

### FR-7 — Sign-in email content (OTP-forward)
- **Description:** A clear, on-brand sign-in email that makes the OTP the obvious primary action.
- **Acceptance criteria:**
  - The **OTP is visually prominent** (large, isolated) and labelled as the preferred way —
    "Enter this code in the app" — with a note that it is single-use and expires in 10 minutes.
  - The **magic link appears below**, framed as an alternative ("or tap this link to sign in").
  - Friendly clan-mate tone. Contains **no** secrets or private data beyond the code and link.
  - A pure email-content builder produces subject + body; unit-tested.
  - **Priority:** Medium

### FR-8 — Web UI: reframed "check your email" step with code entry
- **Description:** Rework the post-send confirmation in `LoginView.vue` from a passive "Magic Link
  Sent!" message into an active **"Check your email"** step centred on entering the code.
- **Acceptance criteria:**
  - Shows a **6-digit code input** + a "Verify & sign in" action as the primary element, with
    helper text noting they can alternatively tap the link in the email.
  - On submit: calls `verifyLoginOtp` → `signInWithCustomToken` → `getIdToken` → POST
    `/api/sessionLogin` → on success redirect home (mirrors the existing magic-link completion).
  - Error states: invalid/expired code (uniform message), with the ability to re-enter or go back.
  - The existing magic-link completion path (`onMounted` → `isSignInWithEmailLink`) and the
    `needsEmailConfirmation` step remain intact.
  - Mobile-first; input ≥44px touch target; numeric inputmode. Component-tested.
  - **Priority:** High

### FR-9 — Web App Manifest link handling
- **Description:** Declare link handling in the PWA manifest so that, on supporting platforms, an
  installed PWA captures the in-scope magic-link URL and opens in-app instead of a browser tab.
- **Acceptance criteria:**
  - The manifest (vite-plugin-pwa config) declares the appropriate link-handling fields
    (`launch_handler` / `handle_links`) and a `scope` covering `/login`.
  - Documented platform reality: this is **opportunistic** (Android/ChromeOS support it; iOS
    Safari does not) — the OTP remains the universal, reliable path. The manifest change must not
    regress install or the existing service-worker config.
  - **Priority:** Low

## Non-Functional Requirements
- **NFR-1 (Security):** OTP is CSPRNG-generated, hashed at rest with a server pepper, compared in
  constant time, **single-use**, **short-lived** (10 min), and **attempt-capped** (5) — and never
  logged. `pendingLogins` is server-only. The SendGrid key and OTP pepper are secrets, never
  logged or sent to the client. **Non-enumeration is preserved** end-to-end: the send response is
  opaque and the verify failure is uniform regardless of account existence.
- **NFR-2 (Quality):** ≥80% coverage. Transport and randomness injected — **no live SendGrid
  calls** and **no mocking libraries** in tests (pass fakes/in-memory/emulator). Send + verify are
  unit/emulator tested.

## User Stories
- *As an admin/owner using the installed app,* I get a code in my email and type it straight into
  the app, *so that* I sign in reliably without worrying which browser the link opens in.
- *As an admin/owner on desktop,* I can still click the magic link, *so that* I'm not forced to
  copy a code when the link works fine.
- *As the owner,* I configure the email provider and OTP pepper via secrets, *so that* nothing
  sensitive lives in code, logs, or the client.

## Technical Considerations
- The `Mailer` interface, `consoleMailer`, `currentMailer`, and `setMailerForTesting` already
  exist in `functions/src/auth.ts`; the interface gains the OTP (e.g. `sendSignInCode(email,
  { code, link })`). Update the single caller (`handleFindAccountForLogin`) + `consoleMailer`.
- Verification reuses `sessionLogin` via a custom token — `getAuth().createCustomToken(uid)` on
  the server, `signInWithCustomToken` on the client. No change to `sessionLogin` itself.
- Reuse the functions HTTP client abstraction (`functions/src/gateway/HttpClient.ts`,
  `nodeHttpClient`) as the injected SendGrid transport so tests pass a fake client.
- SendGrid v3 `POST /v3/mail/send` with `Authorization: Bearer <key>`; sender must be a verified
  single sender / domain in SendGrid.
- Secrets via `firebase-functions/params` `defineSecret('SENDGRID_API_KEY')`, `defineSecret(
  'OTP_PEPPER')`, plus a sender param; bound to `findAccountForLogin` and `verifyLoginOtp`.
- Pure OTP predicates → `@clash-tracker/core`; CSPRNG generation + SHA-256 hashing → `functions/`
  (Node crypto is server-only; keep it out of the browser bundle).

## Out of Scope
- **Google sign-in** — separate track (`google_sign_in_20260620`), itself a further hedge against
  email being a single point of failure.
- Deliverability hardening (custom domain, SPF/DKIM/DMARC), retries/queueing, bounce handling, and
  rich HTML templates beyond the sign-in email — later, if needed.
- Admin invitations / registration emails (Admin view) — this track only wires the existing
  sign-in send (now link + code).
- SMS / authenticator-app OTP — email-delivered code only.
