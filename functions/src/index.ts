import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { makeIngestCurrentWar } from './use-cases/ingestCurrentWar';
import { CocApiGateway } from './gateway/CocApiGateway';
import { SecretsRepository } from './repositories/SecretsRepository';
import { WarRepository } from './repositories/WarRepository';
import { AttackRepository } from './repositories/AttackRepository';
import { nodeHttpClient } from './gateway/HttpClient';
import { parseEncryptionKey } from './crypto';

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

export async function handleScheduledIngest(ingestUseCase = getIngestUseCase()): Promise<void> {
  const encKeyStr = process.env.CLASH_TOKEN_ENC_KEY || '';
  if (!encKeyStr) {
    console.error('CLASH_TOKEN_ENC_KEY is not configured.');
    return;
  }
  const encryptionKey = parseEncryptionKey(encKeyStr);
  const secretsRepo = new SecretsRepository(db, encryptionKey);
  const tagResult = await secretsRepo.getClanTag();
  if (!tagResult.success) {
    console.error(`Cannot run scheduled ingest: ${tagResult.error}`);
    return;
  }
  const clanTag = tagResult.value;
  console.log(`Starting scheduled ingestion for clan tag ${clanTag}`);
  const result = await ingestUseCase(clanTag);
  if (!result.success) {
    console.error(`Scheduled ingestion failed: ${result.error}`);
  } else {
    console.log(`Scheduled ingestion completed successfully: ${JSON.stringify(result.value)}`);
  }
}

export async function handleTriggerIngestNow(
  ingestUseCase = getIngestUseCase()
): Promise<{ success: boolean; syncState?: string; error?: string }> {
  const encKeyStr = process.env.CLASH_TOKEN_ENC_KEY || '';
  if (!encKeyStr) {
    throw new HttpsError('failed-precondition', 'CLASH_TOKEN_ENC_KEY is not configured.');
  }
  const encryptionKey = parseEncryptionKey(encKeyStr);
  const secretsRepo = new SecretsRepository(db, encryptionKey);
  const tagResult = await secretsRepo.getClanTag();
  if (!tagResult.success) {
    throw new HttpsError('failed-precondition', `Clan tag not configured: ${tagResult.error}`);
  }
  const clanTag = tagResult.value;
  const result = await ingestUseCase(clanTag);
  if (!result.success) {
    return {
      success: false,
      error: result.error,
    };
  }
  return {
    success: true,
    syncState: 'synced',
  };
}

export const scheduledIngest = onSchedule('*/20 * * * *', async () => {
  await handleScheduledIngest();
});

export const triggerIngestNow = onCall(async () => {
  return await handleTriggerIngestNow();
});
