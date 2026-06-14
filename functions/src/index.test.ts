import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { Result, ok } from '@clash-tracker/core';
import { IngestSummary } from './use-cases/ingestCurrentWar';
import { RecomputeSummary } from './use-cases/recomputePlayerStats';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SecretsRepository } from './repositories/SecretsRepository';
import { parseEncryptionKey } from './crypto';

type IngestUseCase = (clanTag: string) => Promise<Result<IngestSummary, string>>;
type RecomputeUseCase = () => Promise<Result<RecomputeSummary, string>>;

// A recompute spy that records whether it ran.
function recomputeSpy(
  result: Result<RecomputeSummary, string> = ok({ playersUpserted: 0, current: 0, past: 0 })
) {
  const state = { called: false };
  const fn: RecomputeUseCase = async () => {
    state.called = true;
    return result;
  };
  return { fn, state };
}

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
}

const app = getApps().length === 0 ? initializeApp({ projectId: 'demo-index-cf' }) : getApp();
const db = getFirestore(app);

describe('Cloud Function handlers delegation', () => {
  const encKeyStr = '0123456789abcdef0123456789abcdef'; // 32 bytes UTF-8
  const encryptionKey = parseEncryptionKey(encKeyStr);
  const secretsRepo = new SecretsRepository(db, encryptionKey);

  let handleScheduledIngest: (
    ingestUseCase?: IngestUseCase,
    recomputeUseCase?: RecomputeUseCase
  ) => Promise<void>;
  let handleTriggerIngestNow: (
    ingestUseCase?: IngestUseCase,
    recomputeUseCase?: RecomputeUseCase
  ) => Promise<{ success: boolean; syncState?: string; error?: string }>;
  let triggerIngestNow: {
    (request: { auth: undefined }): Promise<unknown>;
    run?: (request: { auth: undefined }) => Promise<unknown>;
  };

  beforeAll(async () => {
    const mod = await import('./index');
    handleScheduledIngest = mod.handleScheduledIngest;
    handleTriggerIngestNow = mod.handleTriggerIngestNow;
    triggerIngestNow = mod.triggerIngestNow;
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

    const recompute = recomputeSpy();
    await handleScheduledIngest(mockIngest, recompute.fn);
    expect(calledClanTag).toBe('#2PGQYPQ');
  });

  it('handleScheduledIngest recomputes player stats after a successful ingest', async () => {
    const mockIngest: IngestUseCase = async () =>
      ok({ status: 'synced', warId: 'war123', attacksAdded: 2 });
    const recompute = recomputeSpy();

    await handleScheduledIngest(mockIngest, recompute.fn);
    expect(recompute.state.called).toBe(true);
  });

  it('handleScheduledIngest does NOT recompute when the ingest fails', async () => {
    const mockIngest: IngestUseCase = async () => ({ success: false, error: 'maintenance' });
    const recompute = recomputeSpy();

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleScheduledIngest(mockIngest, recompute.fn);
    consoleSpy.mockRestore();
    expect(recompute.state.called).toBe(false);
  });

  it('handleScheduledIngest should log an error if use case returns failure', async () => {
    const mockIngest = async (): Promise<Result<IngestSummary, string>> => {
      return { success: false, error: 'CoC API maintenance' };
    };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleScheduledIngest(mockIngest);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Scheduled ingestion failed: CoC API maintenance')
    );
    consoleSpy.mockRestore();
  });

  it('handleScheduledIngest should print error if CLASH_TOKEN_ENC_KEY is missing', async () => {
    delete process.env.CLASH_TOKEN_ENC_KEY;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleScheduledIngest();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('CLASH_TOKEN_ENC_KEY is not configured.')
    );
    consoleSpy.mockRestore();
  });

  it('handleScheduledIngest should print error if CLASH_TOKEN_ENC_KEY is invalid', async () => {
    process.env.CLASH_TOKEN_ENC_KEY = 'invalid-key';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleScheduledIngest();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot run scheduled ingest: Invalid encryption key.')
    );
    consoleSpy.mockRestore();
  });

  it('handleScheduledIngest should log error if clan tag is not configured in repo', async () => {
    await db.doc('secrets/coc').delete();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleScheduledIngest();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot run scheduled ingest: No secrets found')
    );
    consoleSpy.mockRestore();
  });

  it('handleTriggerIngestNow should fetch clan tag, call use case, and return status', async () => {
    let calledClanTag = '';
    const mockIngest = async (clanTag: string): Promise<Result<IngestSummary, string>> => {
      calledClanTag = clanTag;
      return ok({ status: 'synced', warId: 'war123', attacksAdded: 2 });
    };

    const recompute = recomputeSpy();
    const res = await handleTriggerIngestNow(mockIngest, recompute.fn);
    expect(calledClanTag).toBe('#2PGQYPQ');
    expect(res.success).toBe(true);
    expect(res.syncState).toBe('synced');
    expect(recompute.state.called).toBe(true);
  });

  it('handleTriggerIngestNow still returns success when recompute fails (logged, not fatal)', async () => {
    const mockIngest: IngestUseCase = async () =>
      ok({ status: 'synced', warId: 'war123', attacksAdded: 1 });
    const recompute = recomputeSpy({ success: false, error: 'recompute boom' });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleTriggerIngestNow(mockIngest, recompute.fn);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('recompute boom'));
    consoleSpy.mockRestore();
    expect(res.success).toBe(true);
  });

  it('handleTriggerIngestNow should return success: false if use case fails', async () => {
    const mockIngest = async (): Promise<Result<IngestSummary, string>> => {
      return { success: false, error: 'CoC API error 503' };
    };

    const res = await handleTriggerIngestNow(mockIngest);
    expect(res.success).toBe(false);
    expect(res.error).toBe('CoC API error 503');
  });

  it('handleTriggerIngestNow should throw HttpsError if CLASH_TOKEN_ENC_KEY is missing', async () => {
    delete process.env.CLASH_TOKEN_ENC_KEY;
    await expect(handleTriggerIngestNow()).rejects.toThrowError(
      expect.objectContaining({
        code: 'failed-precondition',
        message: 'CLASH_TOKEN_ENC_KEY is not configured.',
      })
    );
  });

  it('handleTriggerIngestNow should throw HttpsError if CLASH_TOKEN_ENC_KEY is invalid', async () => {
    process.env.CLASH_TOKEN_ENC_KEY = 'invalid-key';
    await expect(handleTriggerIngestNow()).rejects.toThrowError(
      expect.objectContaining({
        code: 'failed-precondition',
        message: expect.stringContaining('Invalid encryption key'),
      })
    );
  });

  it('handleTriggerIngestNow should throw HttpsError if clan tag is missing', async () => {
    await db.doc('secrets/coc').delete();
    await expect(handleTriggerIngestNow()).rejects.toThrowError(
      expect.objectContaining({
        code: 'failed-precondition',
        message: expect.stringContaining('Clan tag not configured'),
      })
    );
  });

  it('triggerIngestNow should reject unauthenticated requests', async () => {
    const handler =
      typeof triggerIngestNow.run === 'function' ? triggerIngestNow.run : triggerIngestNow;
    await expect(handler({ auth: undefined })).rejects.toThrowError(
      expect.objectContaining({
        code: 'unauthenticated',
        message: 'User must be authenticated.',
      })
    );
  });
});
