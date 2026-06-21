# @clash-tracker/functions

Firebase Cloud Functions (2nd gen, TypeScript, Node 20). The only place server-side I/O
happens: the CoC API gateway, scheduled war ingestion, the auth/magic-link endpoints, and
the Firestore repositories that wrap reads/writes.

Pure decision logic is imported from [`@clash-tracker/core`](../packages/core); functions
here are thin adapters around it.

> Scaffolded by Track 1; populated by Tracks 2, 3, 6, 7, 8.

## Scripts

### Seeding Secrets (Emulator/Production)
To seed the Clash of Clans API token and clan tag into Firestore:

```bash
CLASH_TOKEN="<api-token>" CLAN_TAG="<#clan-tag>" CLASH_TOKEN_ENC_KEY="<32-byte-hex-or-base64-key>" npx tsx functions/scripts/seed-secrets.ts
```

- If running against the local emulators, the script defaults to using the Firestore emulator at `127.0.0.1:8080`.
- To verify the seeded secrets and test gateway integration, run:
```bash
npx tsx functions/scripts/verify-seed.ts
```

### Sign-in email config (`RESEND_API_KEY`, `OTP_PEPPER`, `RESEND_SENDER`)
These are plain environment variables read from `process.env` — **not** Secret Manager — so the
deploy needs no Secret Manager IAM.

- **Local/emulator:** nothing required. When unset, the mailer falls back to the `consoleMailer`
  (prints OTP code + magic link to the terminal) and OTPs hash with an empty pepper. To exercise
  the real Resend mailer locally, put values in a git-ignored `functions/.env.local`, which the
  emulator loads into `process.env`.
- **Production:** the CI deploy job writes them into `functions/.env` from GitHub Actions
  secrets/variables (see `.github/workflows/ci.yml`). In production the functions **throw loudly**
  if `OTP_PEPPER` is missing or `dummy`, and the mailer throws if `RESEND_API_KEY` is missing.

