# Implementation Plan: Email Delivery & One-Time-Code Sign-In

Track `email_delivery_20260620`. TDD per `conductor/workflow.md`. Inject all side-effecting deps
(randomness, clock, HTTP transport, repositories) so everything is testable with **no live
Resend calls and no mocking libraries** — pass fakes / in-memory / the emulator. Delivery and
the OTP run on top of Track 6's non-enumerating lookup and `sessionLogin`, which are unchanged.
Guard the secrets: the Resend key, the OTP pepper, and the OTP itself are never logged or sent
to the client.

> Implementer note: the `Mailer` interface, `consoleMailer`, `currentMailer`,
> `setMailerForTesting`, and `handleFindAccountForLogin` already exist in `functions/src/auth.ts`;
> `sessionLogin` already checks account-exists + 5-min `auth_time` freshness. Extend these — do
> not fork a parallel flow. The OTP path converges on `sessionLogin` via a custom token.

## Phase 1: One-time-code domain (pure predicates + server crypto) [checkpoint: 86c516a]

Goal: deterministic, tested code generation/hashing/verification primitives.

- [x] bc44d63 Task: Tests + implement pure predicates in `@clash-tracker/core`: `isValidOtpFormat(code)` (exactly 6 digits), `isOtpExpired(now, expiresAt)`, and `hasExceededOtpAttempts(attempts, max)`.
- [x] d3ba432 Task: Tests + implement, in `functions/`, `generateOtp(rng)` drawing 6 digits from an
  injected CSPRNG (deterministic in tests, preserves leading zeros) and `hashOtp(code, uid,
  pepper)` (SHA-256) with a `constantTimeEquals(a, b)` comparator. Assert equal hashes match,
  any difference fails, and the plaintext code never appears in a hash input that is logged.
- [x] Verification: predicates + generation/hashing covered; generation is uniform over 6 digits
  and hashing is stable + constant-time-compared. [checkpoint]

## Phase 2: Pending-login store, send integration & rules (emulator)

Goal: a known-account sign-in request persists a hashed code and emails code + link; unknown
accounts still leak nothing.

- [x] 976f481 Task: Tests + implement a `pendingLogins` repository (emulator): `put(uid, { hash,
  expiresAt, attempts })` (overwrites any prior code), `get(uid)`, `incrementAttempts(uid)`,
  `delete(uid)`. Isolated test paths.
- [ ] Task: Tests + extend the `Mailer` interface to carry the code (e.g. `sendSignInCode(email,
  { code, link })`); update `consoleMailer` to log both, and `setMailerForTesting` consumers.
- [ ] Task: Emulator tests + extend `handleFindAccountForLogin`: for a **known** account, generate
  an OTP, store its hash via the repository (TTL 10 min, attempts 0), and pass `{ code, link }`
  to the mailer; for an **unknown** account, write nothing and send nothing. Response stays an
  opaque `{ status: 'ok' }`. Assert a second request replaces the prior pending code.
- [ ] Task: Tests + update `firestore.rules` so `pendingLogins` is server-only (deny all client
  read/write); add a rules test (`@firebase/rules-unit-testing`) proving even an admin-claim
  client cannot read/write it.
- [ ] Verification: known account ⇒ hashed code stored + mailer received code & link; unknown ⇒
  nothing; `pendingLogins` unreachable from any client. [checkpoint]

## Phase 3: OTP verification endpoint → session (emulator)

Goal: a correct code signs the user in through the existing cookie path; failures stay uniform.

- [ ] Task: Emulator tests + implement `verifyLoginOtp(usernameOrEmail, code)` (onCall): resolve
  the account via the same non-enumerating lookup, load `pendingLogins/{uid}`, constant-time
  compare, check expiry + attempt cap. **Success:** delete the pending doc and return
  `createCustomToken(uid)`. **Failure:** increment attempts (when a doc exists), invalidate at
  the cap (5), and return a **uniform** "invalid or expired code" error. Cover: success, wrong
  code, expired, cap reached, and unknown account — the last four are indistinguishable to the
  client. Assert the OTP/pepper are never logged.
- [ ] Task: Emulator test + prove convergence: a custom token from `verifyLoginOtp`, signed in and
  exchanged at `sessionLogin`, yields a valid `__session` cookie (fresh `auth_time` passes the
  5-min check; account-exists check passes). `sessionLogin` itself is unchanged.
- [ ] Verification: right code ⇒ session cookie; every wrong/expired/over-limit/unknown case ⇒
  same opaque error, no session, attempts capped. [checkpoint]

## Phase 4: Resend mailer, email content & secrets

Goal: real delivery in production with an OTP-forward email; console in dev; secrets guarded.

- [ ] Task: Tests + implement a pure sign-in-email builder → subject + body with the **OTP
  prominent and labelled preferred** (single-use, expires in 10 min) and the **magic link below**
  as an alternative; friendly tone; no secrets beyond code + link.
- [ ] Task: Tests + implement `makeResendMailer({ httpClient, apiKey, sender })` returning a
  `Mailer`. With a fake `httpClient`, assert the request targets the Resend send endpoint with a
  `Bearer` header and a payload whose `to` = [recipient], `from` = sender, carrying the built
  subject/body (code + link). Assert a non-2xx/transport failure becomes a typed error and that
  the key and OTP are never logged.
- [ ] Task: Tests + define `RESEND_API_KEY`, `OTP_PEPPER`, and the sender param as secrets;
  implement mailer selection (configured ⇒ Resend with `nodeHttpClient`, unconfigured ⇒
  `consoleMailer`) and bind the secrets to `findAccountForLogin` and `verifyLoginOtp`. Assert
  selection both ways and that nothing secret is logged. Missing key ⇒ loud send error.
- [ ] Verification: fake transport ⇒ correct OTP-forward request; selection works both ways; dev
  still logs code + link; secrets never logged or client-bound. Manual: real send against a
  staging/prod project, confirm the email shows code + link. [checkpoint]

## Phase 5: Web UI — reframed "check your email" step with code entry

Goal: the post-send screen is centred on typing the code, completing in-app.

- [ ] Task: Component tests + rework the `status === 'sent'` view in `LoginView.vue` into a
  **"Check your email"** step: a prominent 6-digit code input (numeric inputmode, ≥44px) + a
  "Verify & sign in" primary action, with secondary helper text that they can instead tap the
  link in the email. Keep "Back to sign in".
- [ ] Task: Tests + implement completion: on submit, call `verifyLoginOtp` →
  `signInWithCustomToken` → `getIdToken` → POST `/api/sessionLogin`; on success show the existing
  success state + redirect home; on failure show a uniform "invalid or expired code" message and
  allow retry. Leave the `onMounted` magic-link path and `needsEmailConfirmation` step untouched.
- [ ] Verification: a code entered in the app signs in end-to-end against the emulator; bad codes
  surface a uniform error without leaving the step; magic-link completion still works. Playwright
  spot-check at ~390px. [checkpoint]

## Phase 6: Web App Manifest link handling

Goal: installed PWAs on supporting platforms open the magic link in-app.

- [ ] Task: Add link-handling fields (`launch_handler` / `handle_links`) and a `scope` covering
  `/login` to the vite-plugin-pwa manifest config; assert (manifest unit/build check) the
  generated manifest contains them and that install + the existing SW/`devOptions` config are
  unaffected. Document in the spec/PR that this is opportunistic (Android/ChromeOS; not iOS) and
  that OTP remains the universal path.
- [ ] Verification: generated manifest declares link handling; no regression to install or SW.
  [checkpoint]

## Done when
- A sign-in request in production delivers an email with a **prominent single-use OTP** and the
  magic link below; entering the code **in the PWA** signs the user in via the existing
  session-cookie path (custom token → `sessionLogin`); the Resend key and OTP pepper live only
  in Secret Manager (never logged, never in the client); `pendingLogins` is server-only; the OTP
  is hashed, short-lived, attempt-capped, and single-use; non-enumeration holds end-to-end;
  supporting PWAs can open the link in-app; dev/emulator still logs code + link — all covered by
  unit, emulator, and component tests.
