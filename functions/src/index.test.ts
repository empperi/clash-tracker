import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { Result, ok } from '@clash-tracker/core';
import { IngestSummary } from './use-cases/ingestCurrentWar';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SecretsRepository } from './repositories/SecretsRepository';
import { parseEncryptionKey } from './crypto';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

const app = getApps().length === 0 ? initializeApp({ projectId: 'demo-clash-tracker' }) : getApp();
const db = getFirestore(app);

describe('Cloud Function handlers delegation', () => {
  const encKeyStr = '0123456789abcdef0123456789abcdef'; // 32 bytes UTF-8
  const encryptionKey = parseEncryptionKey(encKeyStr);
  const secretsRepo = new SecretsRepository(db, encryptionKey);

  let handleScheduledIngest: (
    ingestUseCase?: (clanTag: string) => Promise<Result<IngestSummary, string>>
  ) => Promise<void>;
  let handleTriggerIngestNow: (
    ingestUseCase?: (clanTag: string) => Promise<Result<IngestSummary, string>>
  ) => Promise<{ success: boolean; syncState?: string; error?: string }>;

  beforeAll(async () => {
    const mod = await import('./index');
    handleScheduledIngest = mod.handleScheduledIngest;
    handleTriggerIngestNow = mod.handleTriggerIngestNow;
  });

  beforeEach(async () => {
    process.env.CLASH_TOKEN_ENC_KEY = encKeyStr;
    await secretsRepo.setClanTag('#2PGQYPQ');
  });

  it('handleScheduledIngest should fetch clan tag and call use case', async () => {
    let calledClanTag = '';
    const mockIngest = async (clanTag: string): Promise<Result<IngestSummary, string>> => {
      calledClanTag = clanTag;
      return ok({ status: 'synced', warId: 'war123', attacksAdded: 2 });
    };

    await handleScheduledIngest(mockIngest);
    expect(calledClanTag).toBe('#2PGQYPQ');
  });

  it('handleTriggerIngestNow should fetch clan tag, call use case, and return status', async () => {
    let calledClanTag = '';
    const mockIngest = async (clanTag: string): Promise<Result<IngestSummary, string>> => {
      calledClanTag = clanTag;
      return ok({ status: 'synced', warId: 'war123', attacksAdded: 2 });
    };

    const res = await handleTriggerIngestNow(mockIngest);
    expect(calledClanTag).toBe('#2PGQYPQ');
    expect(res.success).toBe(true);
    expect(res.syncState).toBe('synced');
  });
});
