import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest, HttpsError } from 'firebase-functions/v2/https';
import { requireRole } from './auth.js';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { makeIngestCurrentWar, IngestSummary } from './use-cases/ingestCurrentWar.js';
import { makeRecomputePlayerStats, RecomputeSummary } from './use-cases/recomputePlayerStats.js';
import { Result, validateAcceptancePercent, validateMinWarParticipation } from '@clash-tracker/core';
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

// Use Case Factory function to inject dependencies
export function getIngestUseCase() {
  const encKeyStr = process.env.CLASH_TOKEN_ENC_KEY || '';
  const encryptionKey = parseEncryptionKey(encKeyStr);
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
  const encKeyStr = process.env.CLASH_TOKEN_ENC_KEY || '';
  const encryptionKey = parseEncryptionKey(encKeyStr);
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
  const encKeyStr = process.env.CLASH_TOKEN_ENC_KEY || '';
  if (!encKeyStr) {
    console.error('CLASH_TOKEN_ENC_KEY is not configured.');
    return;
  }
  let encryptionKey: Uint8Array;
  try {
    encryptionKey = parseEncryptionKey(encKeyStr);
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
  const encKeyStr = process.env.CLASH_TOKEN_ENC_KEY || '';
  if (!encKeyStr) {
    console.error('handleTriggerIngestNow failed: CLASH_TOKEN_ENC_KEY is not configured.');
    throw new HttpsError('failed-precondition', 'CLASH_TOKEN_ENC_KEY is not configured.');
  }
  let encryptionKey: Uint8Array;
  try {
    encryptionKey = parseEncryptionKey(encKeyStr);
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

      if (field === 'acceptancePct') {
        const validationResult = validateAcceptancePercent(value);
        if (!validationResult.success) {
          res.status(400).send(validationResult.error);
          return;
        }
      } else {
        const validationResult = validateMinWarParticipation(value);
        if (!validationResult.success) {
          res.status(400).send(validationResult.error);
          return;
        }
      }

      await db.collection('publicSettings').doc('config').set(
        { [field]: value },
        { merge: true }
      );

      res.status(200).json({ status: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).send(msg);
    }
  })(req, res);
});

export { sessionLogin, sessionLogout, findAccountForLogin, verifyLoginOtp } from './auth.js';
