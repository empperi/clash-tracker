# Spec: Email Delivery (SendGrid magic-link mailer)

**Track:** `email_delivery_20260620` · **Order:** 7 · **Depends on:** Authentication & roles

## Overview

Make passwordless sign-in actually deliver in production. Track 6 generates the sign-in link
**server-side** (Admin SDK `generateSignInWithEmailLink`) and hands it to an injected
`Mailer`, but the only implementation today is `consoleMailer`, which just logs the link —
so no email ever reaches a user and **production login is impossible**. This track adds a
real `Mailer` backed by **Twilio SendGrid**, with the API key stored as a Firebase secret
(never logged, never sent to the client). The `Mailer` interface already exists, so the
provider is swappable later (Mailgun/SES/etc.) without touching the auth flow.

## Background

See Track 6 (`authentication_roles_20260613`) → `findAccountForLogin` / `Mailer`
(`functions/src/auth.ts`), and `conductor/product.md` → login is for known accounts only,
sent server-side, with no account enumeration. This track changes **delivery only** — the
non-enumerating lookup and link generation are unchanged.

## Functional Requirements

### FR-1 — SendGrid `Mailer` implementation
- **Description:** Implement the existing `Mailer.sendSignInLink(email, link)` using SendGrid's
  mail-send API, with the HTTP transport, API key, and sender identity injected as
  dependencies (functional-first; no live network calls in tests).
- **Acceptance criteria:**
  - Given a fake transport, produces a well-formed request: correct endpoint + `Bearer`
    auth, `to` = recipient, `from` = configured sender, a subject, and a body containing the
    sign-in link.
  - Maps a non-2xx response / transport failure to a typed `Result` error; the caller can
    react without throwing raw provider errors.
  - The API key is **never logged** (not in success or error paths).
- **Priority:** High

### FR-2 — Secret & configuration
- **Description:** Hold the SendGrid API key and sender address as configuration the server
  reads at runtime, as a **Firebase secret** (Secret Manager / `defineSecret`).
- **Acceptance criteria:** key is read only server-side, bound to the function that sends;
  never reaches the client, never logged. Missing/unset key fails the send with a clear
  server error (the link is still generated, but delivery fails loudly rather than silently).
  Console/secret setup is documented.
- **Priority:** High

### FR-3 — Dev vs. prod mailer selection
- **Description:** Use the SendGrid mailer when configured (production); keep `consoleMailer`
  for the emulator/dev (no key required).
- **Acceptance criteria:** selection is explicit and tested — configured ⇒ SendGrid,
  unconfigured ⇒ console. Local dev / emulator behaviour is unchanged (still logs the link).
- **Priority:** High

### FR-4 — Sign-in email content
- **Description:** A clear, on-brand sign-in email.
- **Acceptance criteria:** subject + body in a friendly clan-mate tone, containing the
  sign-in link and a short note that it is single-use / time-limited. Contains **no** secrets
  or private data beyond the link itself.
- **Priority:** Medium

## Non-Functional Requirements
- **NFR-1 (Security):** API key never logged or sent to the client. Emails carry only the
  sign-in link. Non-enumeration is preserved — delivery still happens server-side and only
  for known accounts (unchanged from Track 6).
- **NFR-2 (Quality):** ≥80% coverage. Transport injected — **no live SendGrid calls** in
  tests. The send path is unit/emulator tested with a fake transport.

## User Stories
- *As an admin/owner,* I receive my magic link by email, *so that* I can actually sign in to
  the production app.
- *As the owner,* I configure the email provider via a secret, *so that* the key is never
  exposed in code, logs, or the client.

## Technical Considerations
- The `Mailer` interface, `consoleMailer`, `currentMailer`, and `setMailerForTesting` already
  exist in `functions/src/auth.ts`; add `makeSendGridMailer(deps)` and select it in prod.
- Reuse the functions HTTP client abstraction (`functions/src/gateway/HttpClient.ts`,
  `nodeHttpClient`) as the injected transport so tests pass a fake client.
- SendGrid v3 `POST /v3/mail/send` with `Authorization: Bearer <key>`; sender must be a
  verified single sender / domain in SendGrid.
- Secret via `firebase-functions/params` `defineSecret('SENDGRID_API_KEY')` (+ a sender
  param), bound to `findAccountForLogin`.

## Out of Scope
- **Google sign-in** — separate track (`google_sign_in_20260620`).
- Deliverability hardening (custom domain, SPF/DKIM/DMARC), retries/queueing, bounce
  handling, and rich HTML templates beyond the sign-in email — later, if needed.
- Admin invitations / registration emails (Admin view) — this track only wires the existing
  magic-link send.
