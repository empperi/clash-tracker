import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  }
  const projectId = process.env.GCLOUD_PROJECT || 'militia-clash-tracker';
  console.log(`Reading from Firestore emulator for project: ${projectId}...`);

  const app = getApps().length === 0 ? initializeApp({ projectId }) : getApp();
  const db = getFirestore(app);

  const docRef = db.doc('secrets/coc');
  const snap = await docRef.get();

  if (!snap.exists) {
    console.log('No secrets found in database.');
    return;
  }

  const data = snap.data();
  console.log('\n--- SEEDED DATA ---');
  console.log(`clanTag: ${data?.clanTag}`);
  console.log(`encryptedToken: ${data?.encryptedToken}`);
  console.log('-------------------\n');
}

main().catch((err) => console.error(err));
