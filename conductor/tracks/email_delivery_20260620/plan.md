# Implementation Plan: Email Delivery (SendGrid magic-link mailer)

Track `email_delivery_20260620`. TDD per `conductor/workflow.md`. Inject the HTTP transport,
API key, and sender so the mailer is unit-testable with **no live SendGrid calls** (pass a
fake transport — don't mock). Delivery only — the Track 6 lookup and link generation are
unchanged. Guard the secret: the API key is never logged or sent to the client.

> Implementer note: the `Mailer` interface, `consoleMailer`, `currentMailer`, and
> `setMailerForTesting` already exist in `functions/src/auth.ts`. Add the SendGrid
> implementation behind that interface and select it in production; keep `consoleMailer` for
> dev/emulator.

## Phase 1: SendGrid mailer + email content

Goal: a tested `Mailer` that sends a well-formed request via an injected transport.

- [ ] Task: Tests + implement `makeSendGridMailer({ httpClient, apiKey, sender })` returning a
  `Mailer`. With a fake `httpClient`, assert the request targets the SendGrid send endpoint
  with a `Bearer` auth header and a payload whose `to` = recipient, `from` = configured
  sender, with a subject and a body containing the link. Assert a non-2xx/transport failure
  becomes a typed error and that the API key is never logged.
- [ ] Task: Tests + implement a pure sign-in-email builder (subject + body) — friendly
  clan-mate tone, contains the link and a single-use/time-limited note, and **no** secrets.
- [ ] Verification: the mailer issues a correct request through a fake transport and surfaces
  transport errors. [checkpoint]

## Phase 2: Production wiring & secret

Goal: real delivery in production, console logging in dev — key handled as a secret.

- [ ] Task: Tests + define the `SENDGRID_API_KEY` secret and sender param; implement mailer
  selection: configured ⇒ SendGrid mailer (built with the secret + `nodeHttpClient`),
  unconfigured ⇒ `consoleMailer`. Bind the secret to `findAccountForLogin`. Assert the
  selection logic both ways and that the key is never logged.
- [ ] Task: Emulator test + confirm `findAccountForLogin` delivers via the configured mailer
  for a **known** account (inject a fake transport/mailer; assert it received the generated
  link), and sends **nothing** for an unknown account (non-enumeration preserved).
- [ ] Verification: dev/emulator still logs the link; a configured project sends via SendGrid;
  the key is a secret, never logged or client-bound. Manual: trigger a real send against a
  staging/prod project and confirm receipt. [checkpoint]

## Done when
- A magic-link request in production delivers an email containing a valid, single-use sign-in
  link; the SendGrid API key lives only in Secret Manager (never logged, never in the client);
  dev/emulator behaviour is unchanged; all covered by unit + emulator tests.
