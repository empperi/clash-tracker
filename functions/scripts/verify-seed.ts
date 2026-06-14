import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SecretsRepository } from '../src/repositories/SecretsRepository';
import { CocApiGateway } from '../src/gateway/CocApiGateway';
import { HttpClient, HttpResponse } from '@clash-tracker/core';

// Simple native fetch HttpClient
class NativeHttpClient implements HttpClient {
  async fetch(
    url: string,
    init?: { headers?: Record<string, string>; timeout?: number; method?: string }
  ): Promise<HttpResponse> {
    const controller = init?.timeout ? new AbortController() : null;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (controller && init?.timeout) {
      timeoutId = setTimeout(() => controller.abort(), init.timeout);
    }
    try {
      const res = await fetch(url, {
        method: init?.method || 'GET',
        headers: init?.headers,
        signal: controller?.signal,
      });
      return {
        status: res.status,
        json: () => res.json(),
      };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
}

async function verify() {
  const encKeyStr =
    process.env.CLASH_TOKEN_ENC_KEY ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const clanTag = process.env.CLAN_TAG || '#2PGQYPQ';
  const clashToken = process.env.CLASH_TOKEN || 'dummy-token';

  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  }

  // Import parseEncryptionKey from seed-secrets
  const { parseEncryptionKey } = await import('./seed-secrets');
  const encryptionKey = parseEncryptionKey(encKeyStr);

  const app =
    getApps().length === 0 ? initializeApp({ projectId: 'demo-clash-tracker' }) : getApp();
  const db = getFirestore(app);

  const repo = new SecretsRepository(db, encryptionKey);

  console.log('--- Verification Step 1: Seed / Check Repository ---');
  let dbTagRes = await repo.getClanTag();
  let dbTokenRes = await repo.getDecryptedToken();

  if (!dbTagRes.success || !dbTokenRes.success) {
    console.log('No secrets found in database. Seeding dummy secrets now...');
    await repo.setClanTag(clanTag);
    await repo.setToken(clashToken);
    dbTagRes = await repo.getClanTag();
    dbTokenRes = await repo.getDecryptedToken();
    if (!dbTagRes.success || !dbTokenRes.success) {
      console.error('Verification failed: Could not seed secrets in the database.');
      process.exit(1);
    }
  }

  console.log(`Successfully verified stored clan tag: ${dbTagRes.value}`);
  console.log(`Successfully verified stored token length: ${dbTokenRes.value.length}`);

  console.log('--- Verification Step 2: Call getClan via CocApiGateway ---');
  const client = new NativeHttpClient();
  const gateway = new CocApiGateway(client, repo);

  const result = await gateway.getClan(dbTagRes.value);
  if (result.success) {
    console.log('Success! Call to getClan returned a valid clan object.');
    console.log(`Fetched clan members count: ${result.value.length}`);
    if (result.value.length > 0) {
      console.log(`First member tag & name: ${result.value[0].tag} - ${result.value[0].name}`);
    }
  } else {
    console.log(
      `getClan call returned an error (expected if dummy token/IP is blocked): ${result.error}`
    );
  }
  console.log('Verification run finished successfully.');
}

verify().catch((err) => {
  console.error('Verification script failed:', err);
  process.exit(1);
});
