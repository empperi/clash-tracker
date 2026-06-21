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

### Emulator Secrets Override (`.secret.local`)
The Cloud Functions use bound secrets (such as `RESEND_API_KEY`, `OTP_PEPPER`, and `RESEND_SENDER`). To prevent the Firebase Emulator from attempting to contact the live Google Cloud Secret Manager API (and throwing permission or connection warnings due to the fake project ID `demo-clash-tracker`), you must provide local secret values.

Copy the example file to `.secret.local` inside the `functions` directory:
```bash
cp functions/.secret.local.example functions/.secret.local
```

By default, these are set to `"dummy"` values. This satisfies the presence check for the emulator, preventing it from contacting the GCP API, and correctly causes the mailer setup to default to the local `consoleMailer` (which prints OTP codes and links to the terminal console).

