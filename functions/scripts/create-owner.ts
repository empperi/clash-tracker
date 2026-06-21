/**
 * Manually create (or update) a single owner/admin account — the bootstrap for the FIRST
 * owner, since admin/owner accounts are otherwise created via invitations that themselves
 * require an existing owner.
 *
 * Creates the three things the sign-in flow needs, all keyed to one uid:
 *   1. a Firebase Auth user (email + displayName),
 *   2. an accounts/{uid} Firestore doc { username, email, role, playerTag? } that
 *      findAccountForLogin looks up,
 *   3. a custom claim { role } on the Auth user (what requireRole / the UI capabilities read).
 *
 * Idempotent: re-running updates the existing user, doc, and claim.
 *
 * LOCAL emulator (default when no real credentials are configured):
 *   npm run emulators                                  # terminal 1
 *   OWNER_EMAIL=you@example.com OWNER_USERNAME=Chief \
 *     npx tsx functions/scripts/create-owner.ts        # terminal 2
 *
 * PRODUCTION (uses Application Default Credentials — the SDK refuses to run otherwise):
 *   gcloud auth application-default login               # or export GOOGLE_APPLICATION_CREDENTIALS=<sa-key.json>
 *   GCLOUD_PROJECT=militia-clash-tracker \
 *   OWNER_EMAIL=you@example.com OWNER_USERNAME=Chief OWNER_PLAYER_TAG='#YOURTAG' \
 *     npx tsx functions/scripts/create-owner.ts
 *
 * Env: OWNER_EMAIL (required), OWNER_USERNAME (required), OWNER_PLAYER_TAG (optional),
 *      OWNER_ROLE (optional, "owner" | "admin", default "owner").
 */
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

async function main(): Promise<void> {
  // Email is lowercased so it matches findAccountForLogin's case-insensitive lookup path.
  const email = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
  const username = (process.env.OWNER_USERNAME || '').trim();
  const playerTag = process.env.OWNER_PLAYER_TAG?.trim();
  const role = (process.env.OWNER_ROLE || 'owner').trim();

  if (!email || !username) {
    console.error('Error: OWNER_EMAIL and OWNER_USERNAME must be set in the environment.');
    process.exit(1);
  }
  if (role !== 'owner' && role !== 'admin') {
    console.error(`Error: OWNER_ROLE must be "owner" or "admin" (got "${role}").`);
    process.exit(1);
  }

  // Default to the emulator only when no real credentials are configured — mirrors seed-secrets.
  if (!process.env.FIRESTORE_EMULATOR_HOST && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST =
      process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
    console.log('No ADC configured — targeting the LOCAL emulator (Firestore 8080 / Auth 9099).');
  }

  const projectId = process.env.GCLOUD_PROJECT || 'militia-clash-tracker';
  const targetingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  console.log(
    `Initializing Firebase Admin SDK for project "${projectId}" (${targetingEmulator ? 'EMULATOR' : 'PRODUCTION'})...`
  );

  const app = getApps().length === 0 ? initializeApp({ projectId }) : getApp();
  const db = getFirestore(app);
  const auth = getAuth(app);

  // 1. Create or reuse the Auth user (keyed by email).
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    await auth.updateUser(uid, { displayName: username });
    console.log(`Reusing existing Auth user ${uid} for ${email}.`);
  } catch {
    const created = await auth.createUser({ email, displayName: username });
    uid = created.uid;
    console.log(`Created Auth user ${uid} for ${email}.`);
  }

  // 2. Upsert the accounts/{uid} doc the login lookup reads.
  const accountDoc: Record<string, unknown> = { username, email, role };
  if (playerTag) accountDoc.playerTag = playerTag;
  await db.collection('accounts').doc(uid).set(accountDoc, { merge: true });
  console.log(`Wrote accounts/${uid}:`, accountDoc);

  // 3. Mirror the role into custom claims (what requireRole / capabilities use).
  await auth.setCustomUserClaims(uid, { role });
  const updated = await auth.getUser(uid);
  console.log(`Set custom claims for ${email}:`, updated.customClaims);

  console.log(`\nDone. ${email} can now sign in at /login as "${role}".`);
}

main().catch((err) => {
  console.error('Failed to create owner:', err);
  process.exit(1);
});
