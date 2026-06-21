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

### Bootstrapping the first owner (`create-owner.ts`)
Owner/admin accounts are normally created via invitations, which require an existing owner — so
the **first** owner must be created by hand. `create-owner.ts` creates the Auth user, the
`accounts/{uid}` doc, and the `{ role }` custom claim together (all keyed to one uid).

Against **production** (uses Application Default Credentials; the SDK won't touch prod without them):

```bash
gcloud auth application-default login          # or export GOOGLE_APPLICATION_CREDENTIALS=<sa-key.json>
USE_EMULATOR=false GCLOUD_PROJECT=militia-clash-tracker \
OWNER_EMAIL="you@example.com" OWNER_USERNAME="Chief" OWNER_PLAYER_TAG="#YOURTAG" \
  npx tsx functions/scripts/create-owner.ts
```

> `USE_EMULATOR=false` is required for production — `gcloud auth application-default login` writes
> ADC to a well-known file (it does **not** set `GOOGLE_APPLICATION_CREDENTIALS`), so the script
> can't auto-detect it and defaults to the emulator otherwise. The startup log prints `EMULATOR`
> or `PRODUCTION` — check it before trusting the run.

Against the **emulator** (default), run with the emulators up — it uses Firestore `8080` / Auth
`9099`. `OWNER_ROLE` defaults to `owner` (set `admin` for an admin). Re-running is idempotent. The
account can then sign in at `/login`.

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

