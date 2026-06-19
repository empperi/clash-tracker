import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Seeds mock players + thresholds into the LOCAL Firestore emulator so the
 * Player List view can be previewed without a real ingestion.
 *
 * Writes to project `demo-clash-tracker` (the id the web dev build uses against
 * the emulators — see web/src/firebase-setup.ts). Run with the emulators up:
 *
 *   npm run emulators                       # terminal 1
 *   npx tsx functions/scripts/seed-mock-players.ts   # terminal 2
 *   npm run dev --workspace web             # terminal 3 -> http://localhost:5173
 *
 * Re-running is idempotent (docs are keyed by tag). Player docs use the flat
 * field shape the functions PlayerRepository writes and the web playerFromDoc reads.
 */

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

interface MockPlayer {
  tag: string;
  name: string;
  role: 'leader' | 'coLeader' | 'elder' | 'member';
  thLevel: number;
  inClan: boolean;
  warsParticipated: number;
  attacksDone: number;
  attacksAvailable: number;
  attackUsagePct: number;
  medianDestruction: number;
  medianStars: number;
  medianDefenses: number;
  medianOwnDestruction: number;
  lastWarParticipatedAt: string | null;
}

const CURRENT: MockPlayer[] = [
  p('#LEADER', 'Warlord', 'leader', 16, 15, 29, 30, 97, 96, 3, 2, 38),
  p('#CO1', 'IronFist', 'coLeader', 16, 14, 26, 28, 93, 92, 3, 2, 41),
  p('#CO2', 'StormQueen', 'coLeader', 15, 12, 21, 24, 88, 85, 2, 1, 55),
  p('#E1', 'Ranger', 'elder', 15, 10, 16, 20, 80, 78, 2, 1, 60),
  p('#E2', 'Goblin', 'elder', 14, 11, 14, 22, 64, 61, 1, 2, 72),
  p('#M1', 'Sparrow', 'member', 13, 8, 9, 16, 56, 58, 1, 1, 80),
  p('#M2', 'Slacker', 'member', 14, 9, 5, 18, 28, 40, 1, 3, 90),
  p('#M3', 'FreshMeat', 'member', 12, 3, 6, 6, 100, 99, 3, 0, 20),
];

const PAST: MockPlayer[] = [
  past('#LEFT1', 'GoneGuy', 'member', 15, 20, 70, '2026-06-10T10:00:00.000Z'),
  past('#LEFT2', 'OldTimer', 'elder', 14, 18, 55, '2026-05-20T10:00:00.000Z'),
  past('#LEFT3', 'Quitter', 'member', 13, 6, 40, '2026-04-15T10:00:00.000Z'),
];

function p(
  tag: string,
  name: string,
  role: MockPlayer['role'],
  thLevel: number,
  warsParticipated: number,
  attacksDone: number,
  attacksAvailable: number,
  attackUsagePct: number,
  medianDestruction: number,
  medianStars: number,
  medianDefenses: number,
  medianOwnDestruction: number
): MockPlayer {
  return {
    tag,
    name,
    role,
    thLevel,
    inClan: true,
    warsParticipated,
    attacksDone,
    attacksAvailable,
    attackUsagePct,
    medianDestruction,
    medianStars,
    medianDefenses,
    medianOwnDestruction,
    lastWarParticipatedAt: '2026-06-14T10:00:00.000Z',
  };
}

function past(
  tag: string,
  name: string,
  role: MockPlayer['role'],
  thLevel: number,
  warsParticipated: number,
  attackUsagePct: number,
  lastWarParticipatedAt: string
): MockPlayer {
  return {
    tag,
    name,
    role,
    thLevel,
    inClan: false,
    warsParticipated,
    attacksDone: Math.round((attackUsagePct / 100) * warsParticipated * 2),
    attacksAvailable: warsParticipated * 2,
    attackUsagePct,
    medianDestruction: Math.max(40, attackUsagePct - 5),
    medianStars: 2,
    medianDefenses: 1,
    medianOwnDestruction: 65,
    lastWarParticipatedAt,
  };
}

async function main(): Promise<void> {
  const app =
    getApps().length === 0 ? initializeApp({ projectId: 'demo-clash-tracker' }) : getApp();
  const db = getFirestore(app);

  await db
    .doc('publicSettings/config')
    .set({ clanName: 'Militia', acceptancePct: 70, minWarParticipation: 5 }, { merge: true });

  const all = [...CURRENT, ...PAST];
  for (const player of all) {
    await db.doc(`players/${player.tag}`).set(player, { merge: true });
  }

  // Seed mock admin and owner accounts for login testing
  await db.doc('accounts/mock-admin-uid').set({
    username: 'ChiefAdmin',
    email: 'admin@example.internal',
    role: 'admin',
    playerTag: '#CO1',
  }, { merge: true });

  await db.doc('accounts/mock-owner-uid').set({
    username: 'ChiefOwner',
    email: 'owner@example.internal',
    role: 'owner',
    playerTag: '#LEADER',
  }, { merge: true });

  console.log(
    `Seeded ${CURRENT.length} current + ${PAST.length} past players, thresholds (70% / 5 wars), and mock accounts (ChiefAdmin, ChiefOwner) into demo-clash-tracker.`
  );
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
