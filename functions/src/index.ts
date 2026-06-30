import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest, HttpsError } from 'firebase-functions/v2/https';
import { requireRole, getMailer, revokeAccountSessions } from './auth.js';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { makeIngestCurrentWar, IngestSummary } from './use-cases/ingestCurrentWar.js';
import { makeRecomputePlayerStats, RecomputeSummary } from './use-cases/recomputePlayerStats.js';
import {
  Result,
  validateAcceptancePercent,
  validateMinWarParticipation,
  validateEmail,
  isInvitationExpired,
  normalizePlayerTag,
  validatePlayerTag,
  validateClanName,
  validateConfigClanTag,
  validateApiToken,
  canDeleteAccount,
} from '@clash-tracker/core';
import { CocApiGateway } from './gateway/CocApiGateway.js';
import { SecretsRepository } from './repositories/SecretsRepository.js';
import { WarRepository } from './repositories/WarRepository.js';
import { AttackRepository } from './repositories/AttackRepository.js';
import { PlayerRepository } from './repositories/PlayerRepository.js';
import { nodeHttpClient } from './gateway/HttpClient.js';
import { parseEncryptionKey } from './crypto.js';

type IngestUseCase = (clanTag: string) => Promise<Result<IngestSummary, string>>;
type RecomputeUseCase = () => Promise<Result<RecomputeSummary, string>>;

// Set global options to deploy to Europe (Belgium)
setGlobalOptions({ region: 'europe-west1' });

// Initialize firebase admin
const app = getApps().length === 0 ? initializeApp() : getApp();
const db = getFirestore(app);

function getEncryptionKey(): Uint8Array {
  let encKeyStr = process.env.CLASH_TOKEN_ENC_KEY || '';
  if (
    !encKeyStr &&
    process.env.VITEST !== 'true' &&
    (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.FIRESTORE_EMULATOR_HOST)
  ) {
    // Fallback to a dummy 32-byte base64-encoded key for local development against emulators
    encKeyStr = 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=';
  }
  return parseEncryptionKey(encKeyStr);
}

// Use Case Factory function to inject dependencies
export function getIngestUseCase() {
  const encryptionKey = getEncryptionKey();
  const secretsRepo = new SecretsRepository(db, encryptionKey);
  const gateway = new CocApiGateway(nodeHttpClient, secretsRepo);
  const warRepo = new WarRepository(db);
  const attackRepo = new AttackRepository(db);

  return makeIngestCurrentWar({
    gateway,
    warRepo,
    attackRepo,
    now: () => new Date(),
  });
}

// Recompute use case factory. The clan roster comes from the live clan fetch.
export function getRecomputeUseCase(clanTag: string): RecomputeUseCase {
  const encryptionKey = getEncryptionKey();
  const secretsRepo = new SecretsRepository(db, encryptionKey);
  const gateway = new CocApiGateway(nodeHttpClient, secretsRepo);
  const warRepo = new WarRepository(db);
  const playerRepo = new PlayerRepository(db);
  const clanRepo = { getCurrentMembers: () => gateway.getClan(clanTag) };

  return makeRecomputePlayerStats({ warRepo, clanRepo, playerRepo });
}

export async function handleScheduledIngest(
  ingestUseCase?: IngestUseCase,
  recomputeUseCase?: RecomputeUseCase
): Promise<void> {
  const hasKey =
    !!process.env.CLASH_TOKEN_ENC_KEY ||
    (process.env.VITEST !== 'true' &&
      (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.FIRESTORE_EMULATOR_HOST));
  if (!hasKey) {
    console.error('CLASH_TOKEN_ENC_KEY is not configured.');
    return;
  }
  let encryptionKey: Uint8Array;
  try {
    encryptionKey = getEncryptionKey();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Cannot run scheduled ingest: Invalid encryption key. ${msg}`);
    return;
  }
  const secretsRepo = new SecretsRepository(db, encryptionKey);
  const tagResult = await secretsRepo.getClanTag();
  if (!tagResult.success) {
    console.error(`Cannot run scheduled ingest: ${tagResult.error}`);
    return;
  }
  const clanTag = tagResult.value;
  console.log(`Starting scheduled ingestion for clan tag ${clanTag}`);
  const useCase = ingestUseCase || getIngestUseCase();
  const result = await useCase(clanTag);
  if (!result.success) {
    console.error(`Scheduled ingestion failed: ${result.error}`);
    return;
  }
  console.log(`Scheduled ingestion completed successfully: ${JSON.stringify(result.value)}`);

  // Refresh player aggregates after a successful ingest.
  const recompute = recomputeUseCase || getRecomputeUseCase(clanTag);
  const recomputeResult = await recompute();
  if (!recomputeResult.success) {
    console.error(`Player stats recompute failed: ${recomputeResult.error}`);
  } else {
    console.log(`Player stats recomputed: ${JSON.stringify(recomputeResult.value)}`);
  }
}

export async function handleTriggerIngestNow(
  ingestUseCase?: IngestUseCase,
  recomputeUseCase?: RecomputeUseCase
): Promise<{ success: boolean; syncState?: string; error?: string }> {
  console.log('handleTriggerIngestNow: starting execution...');
  const hasKey =
    !!process.env.CLASH_TOKEN_ENC_KEY ||
    (process.env.VITEST !== 'true' &&
      (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.FIRESTORE_EMULATOR_HOST));
  if (!hasKey) {
    console.error('handleTriggerIngestNow failed: CLASH_TOKEN_ENC_KEY is not configured.');
    throw new HttpsError('failed-precondition', 'CLASH_TOKEN_ENC_KEY is not configured.');
  }
  let encryptionKey: Uint8Array;
  try {
    encryptionKey = getEncryptionKey();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`handleTriggerIngestNow failed: Invalid encryption key: ${msg}`);
    throw new HttpsError('failed-precondition', `Invalid encryption key: ${msg}`);
  }
  const secretsRepo = new SecretsRepository(db, encryptionKey);
  const tagResult = await secretsRepo.getClanTag();
  if (!tagResult.success) {
    console.error(`handleTriggerIngestNow failed: Clan tag not configured: ${tagResult.error}`);
    throw new HttpsError('failed-precondition', `Clan tag not configured: ${tagResult.error}`);
  }
  const clanTag = tagResult.value;
  console.log(`handleTriggerIngestNow: fetched clan tag ${clanTag}, triggering ingestion...`);
  const useCase = ingestUseCase || getIngestUseCase();
  const result = await useCase(clanTag);
  if (!result.success) {
    console.error(
      `handleTriggerIngestNow failed: Ingestion failed for clan tag ${clanTag}: ${result.error}`
    );
    return {
      success: false,
      error: result.error,
    };
  }
  console.log(
    `handleTriggerIngestNow: Ingestion succeeded. Summary: ${JSON.stringify(result.value)}`
  );

  // Refresh player aggregates after a successful ingest (failures are logged,
  // not fatal — the ingest itself succeeded).
  const recompute = recomputeUseCase || getRecomputeUseCase(clanTag);
  const recomputeResult = await recompute();
  if (!recomputeResult.success) {
    console.error(`Player stats recompute failed: ${recomputeResult.error}`);
  } else {
    console.log(`Player stats recompute succeeded: ${JSON.stringify(recomputeResult.value)}`);
  }

  return {
    success: true,
    syncState: 'synced',
  };
}

export const scheduledIngest = onSchedule('*/20 * * * *', async () => {
  console.log('scheduledIngest function triggered.');
  await handleScheduledIngest();
});

export let overrideIngestUseCase: IngestUseCase | undefined;
export let overrideRecomputeUseCase: RecomputeUseCase | undefined;

export function setIngestUseCaseForTesting(useCase: IngestUseCase | undefined) {
  overrideIngestUseCase = useCase;
}
export function setRecomputeUseCaseForTesting(useCase: RecomputeUseCase | undefined) {
  overrideRecomputeUseCase = useCase;
}

export const triggerIngestNow = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  await requireRole('admin')(async (req, res) => {
    try {
      const result = await handleTriggerIngestNow(overrideIngestUseCase, overrideRecomputeUseCase);
      res.status(200).json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).send(msg);
    }
  })(req, res);
});

export const setThreshold = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  await requireRole('admin')(async (req, res) => {
    try {
      const field = req.body?.field;
      const value = req.body?.value;

      if (field !== 'acceptancePct' && field !== 'minWarParticipation') {
        res.status(400).send('Invalid field: must be acceptancePct or minWarParticipation.');
        return;
      }

      let validatedValue: number;

      if (field === 'acceptancePct') {
        const validationResult = validateAcceptancePercent(value);
        if (!validationResult.success) {
          res.status(400).send(validationResult.error);
          return;
        }
        validatedValue = validationResult.value;
      } else {
        const validationResult = validateMinWarParticipation(value);
        if (!validationResult.success) {
          res.status(400).send(validationResult.error);
          return;
        }
        validatedValue = validationResult.value;
      }

      await db
        .collection('publicSettings')
        .doc('config')
        .set({ [field]: validatedValue }, { merge: true });

      res.status(200).json({ status: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).send(msg);
    }
  })(req, res);
});

export const setClanName = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  await requireRole('owner')(async (req, res) => {
    try {
      const value = req.body?.value;
      const validationResult = validateClanName(value);
      if (!validationResult.success) {
        res.status(400).send(validationResult.error);
        return;
      }

      await db
        .collection('publicSettings')
        .doc('config')
        .set({ clanName: validationResult.value }, { merge: true });

      res.status(200).json({ status: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).send(msg);
    }
  })(req, res);
});

export const setClanTag = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  await requireRole('owner')(async (req, res) => {
    try {
      const value = req.body?.value;
      const validationResult = validateConfigClanTag(value);
      if (!validationResult.success) {
        res.status(400).send(validationResult.error);
        return;
      }

      const encryptionKey = getEncryptionKey();
      const secretsRepo = new SecretsRepository(db, encryptionKey);
      const setResult = await secretsRepo.setClanTag(validationResult.value);
      if (!setResult.success) {
        res.status(500).send(setResult.error);
        return;
      }

      await db
        .collection('publicSettings')
        .doc('config')
        .set({ clanTag: validationResult.value }, { merge: true });

      res.status(200).json({ status: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).send(msg);
    }
  })(req, res);
});

export const setApiToken = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  await requireRole('owner')(async (req, res) => {
    try {
      const value = req.body?.value;
      const validationResult = validateApiToken(value);
      if (!validationResult.success) {
        res.status(400).send(validationResult.error);
        return;
      }

      const encryptionKey = getEncryptionKey();
      const secretsRepo = new SecretsRepository(db, encryptionKey);
      const setResult = await secretsRepo.setToken(validationResult.value);
      if (!setResult.success) {
        res.status(500).send(setResult.error);
        return;
      }

      res.status(200).json({ status: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).send(msg);
    }
  })(req, res);
});

export const getApiTokenStatus = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  await requireRole('owner')(async (req, res) => {
    try {
      const docSnap = await db.collection('secrets').doc('coc').get();
      const hasToken = docSnap.exists && typeof docSnap.data()?.encryptedToken === 'string';
      res.status(200).json({ hasToken });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).send(msg);
    }
  })(req, res);
});

export const inviteAdmin = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  await requireRole('admin')(async (req, res) => {
    try {
      const emailInput = req.body?.email;
      const validationResult = validateEmail(emailInput);
      if (!validationResult.success) {
        res.status(400).send(validationResult.error);
        return;
      }
      const validatedEmail = validationResult.value;

      // Check if user is already registered in accounts collection
      const userSnapshot = await db
        .collection('accounts')
        .where('email', '==', validatedEmail)
        .get();
      if (!userSnapshot.empty) {
        res.status(409).send('User is already registered with this email');
        return;
      }

      // Check if there is an active invite in pendingAccounts
      const snapshot = await db
        .collection('pendingAccounts')
        .where('email', '==', validatedEmail)
        .get();

      let hasActiveInvite = false;
      const now = new Date();
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const createdAt = data.createdAt.toDate();
        if (isInvitationExpired(createdAt, now)) {
          await doc.ref.delete();
        } else {
          hasActiveInvite = true;
        }
      }

      if (hasActiveInvite) {
        res.status(409).send('Email is already invited');
        return;
      }

      // Create new pending invitation
      const inviteDocRef = db.collection('pendingAccounts').doc();
      const inviteId = inviteDocRef.id;
      await inviteDocRef.set({
        email: validatedEmail,
        role: 'admin',
        createdAt: now,
      });

      const origin = req.headers?.origin || 'http://localhost:5173';
      const link = `${origin}/register?inviteId=${inviteId}`;

      try {
        const mailer = getMailer();
        await mailer.sendInvitation(validatedEmail, { inviteId, link });
      } catch (mailError) {
        await inviteDocRef.delete();
        throw mailError;
      }

      res.status(200).json({ status: 'success', inviteId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).send(msg);
    }
  })(req, res);
});

export const listPendingInvites = onRequest(async (req, res) => {
  await requireRole('admin')(async (req, res) => {
    try {
      const snapshot = await db.collection('pendingAccounts').get();
      const list = [];
      const now = new Date();
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const createdAt = data.createdAt.toDate();
        const expired = isInvitationExpired(createdAt, now);

        if (expired) {
          await doc.ref.delete();
        }

        list.push({
          id: doc.id,
          email: data.email,
          role: data.role,
          createdAt: createdAt.toISOString(),
          expired,
        });
      }
      res.status(200).json(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).send(msg);
    }
  })(req, res);
});

export const revokeInvite = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  await requireRole('admin')(async (req, res) => {
    try {
      const id = req.body?.id;
      if (!id || typeof id !== 'string') {
        res.status(400).send('Missing or invalid invite ID');
        return;
      }

      await db.collection('pendingAccounts').doc(id).delete();
      res.status(200).json({ status: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).send(msg);
    }
  })(req, res);
});

export const getInviteStatus = onRequest(async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  try {
    const inviteId = req.query?.inviteId;
    if (!inviteId || typeof inviteId !== 'string') {
      res.status(400).send('Missing or invalid inviteId');
      return;
    }

    const doc = await db.collection('pendingAccounts').doc(inviteId).get();
    if (!doc.exists) {
      res.status(200).json({ exists: false });
      return;
    }

    const data = doc.data();
    if (!data) {
      res.status(200).json({ exists: false });
      return;
    }

    const createdAt = data.createdAt.toDate();
    const now = new Date();
    const expired = isInvitationExpired(createdAt, now);
    if (expired) {
      await doc.ref.delete();
      res.status(200).json({ exists: true, expired: true, email: data.email });
      return;
    }

    res.status(200).json({ exists: true, expired: false, email: data.email });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).send(msg);
  }
});

export const completeRegistration = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const { inviteId, username, playerTag } = req.body || {};
    if (!inviteId || !username || !playerTag) {
      res.status(400).send('Missing required fields (inviteId, username, playerTag).');
      return;
    }

    const inviteDocRef = db.collection('pendingAccounts').doc(inviteId);
    const inviteDoc = await inviteDocRef.get();
    if (!inviteDoc.exists) {
      res.status(400).send('Invitation not found or invalid');
      return;
    }

    const inviteData = inviteDoc.data();
    if (!inviteData) {
      res.status(400).send('Invitation data is empty');
      return;
    }

    const createdAt = inviteData.createdAt.toDate();
    const now = new Date();
    if (isInvitationExpired(createdAt, now)) {
      await inviteDocRef.delete();
      res.status(400).send('Invitation has expired');
      return;
    }

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      res.status(400).send('Username cannot be empty');
      return;
    }

    const normalizedTag = normalizePlayerTag(playerTag);
    if (!validatePlayerTag(normalizedTag)) {
      res.status(400).send('Invalid player tag');
      return;
    }

    const email = inviteData.email;
    const auth = getAuth(app);
    let uid: string;
    try {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
      await auth.updateUser(uid, { displayName: trimmedUsername });
    } catch {
      const created = await auth.createUser({ email, displayName: trimmedUsername });
      uid = created.uid;
    }

    const role = 'admin';
    await auth.setCustomUserClaims(uid, { role });

    await db.collection('accounts').doc(uid).set({
      email,
      username: trimmedUsername,
      playerTag: normalizedTag,
      role,
      createdAt: now,
    });

    await inviteDocRef.delete();

    const customToken = await auth.createCustomToken(uid);
    res.status(200).json({ status: 'success', customToken });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).send(msg);
  }
});

export const listAccounts = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  await requireRole('owner')(async (req, res) => {
    try {
      // 1. Fetch active accounts
      const activeSnapshot = await db.collection('accounts').get();
      const activeList = activeSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          email: data.email || '',
          role: data.role || 'admin',
          status: 'active' as const,
          username: data.username || undefined,
        };
      });

      // 2. Fetch pending accounts
      const pendingSnapshot = await db.collection('pendingAccounts').get();
      const now = new Date();
      const pendingList = [];
      for (const doc of pendingSnapshot.docs) {
        const data = doc.data();
        const createdAt = data.createdAt.toDate();
        const expired = isInvitationExpired(createdAt, now);

        if (expired) {
          await doc.ref.delete();
          continue; // Skip expired ones from the returned list
        }

        pendingList.push({
          uid: doc.id,
          email: data.email || '',
          role: data.role || 'admin',
          status: 'pending' as const,
        });
      }

      const combined = [...activeList, ...pendingList];
      res.status(200).json(combined);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).send(msg);
    }
  })(req, res);
});

export const deleteAccount = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  await requireRole('owner')(async (req, res) => {
    try {
      const targetUid = req.body?.uid;
      if (!targetUid || typeof targetUid !== 'string') {
        res.status(400).send('Missing target account uid.');
        return;
      }

      const callerUid = req.auth?.uid;
      if (!canDeleteAccount(targetUid, callerUid || '')) {
        res.status(400).send('Self-deletion is refused.');
        return;
      }

      // Check active accounts
      const activeDocRef = db.collection('accounts').doc(targetUid);
      const activeDoc = await activeDocRef.get();
      if (activeDoc.exists) {
        await activeDocRef.delete();
        try {
          await getAuth().deleteUser(targetUid);
        } catch (err) {
          console.warn(`Failed to delete Auth user ${targetUid}:`, err);
        }
        try {
          await revokeAccountSessions(targetUid);
        } catch (err) {
          console.warn(`Failed to revoke sessions for ${targetUid}:`, err);
        }
        res.status(200).json({ status: 'success' });
        return;
      }

      // Check pending accounts
      const pendingDocRef = db.collection('pendingAccounts').doc(targetUid);
      const pendingDoc = await pendingDocRef.get();
      if (pendingDoc.exists) {
        await pendingDocRef.delete();
        res.status(200).json({ status: 'success' });
        return;
      }

      res.status(404).send('Account not found.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).send(msg);
    }
  })(req, res);
});

export { sessionLogin, sessionLogout, findAccountForLogin, verifyLoginOtp } from './auth.js';
