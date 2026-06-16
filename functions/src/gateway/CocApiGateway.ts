import {
  Result,
  ok,
  err,
  HttpClient,
  classifyCocError,
  mapClan,
  mapWar,
  MappedMember,
  MappedWar,
  CocApiError,
} from '@clash-tracker/core';
import { SecretsRepository } from '../repositories/SecretsRepository.js';

export class CocApiGateway {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly secretsRepository: SecretsRepository,
    private readonly baseUrl: string = process.env.COC_API_BASE_URL ||
      'https://api.clashofclans.com/v1',
    private readonly timeoutMs: number = 10000
  ) {}

  /**
   * Fetches the clan details and members list.
   */
  async getClan(clanTag: string): Promise<Result<readonly MappedMember[], CocApiError>> {
    try {
      const tokenResult = await this.secretsRepository.getDecryptedToken();
      if (!tokenResult.success) {
        return err('Unknown');
      }

      const encodedTag = encodeURIComponent(clanTag);
      const url = `${this.baseUrl}/clans/${encodedTag}`;

      const response = await this.httpClient.fetch(url, {
        headers: {
          Authorization: `Bearer ${tokenResult.value}`,
          Accept: 'application/json',
        },
        timeout: this.timeoutMs,
      });

      if (response.status !== 200) {
        return err(classifyCocError(response.status));
      }

      const json = await response.json();
      return ok(mapClan(json));
    } catch {
      return err('Unknown');
    }
  }

  /**
   * Fetches the current war details.
   */
  async getCurrentWar(clanTag: string): Promise<Result<MappedWar, CocApiError>> {
    try {
      const tokenResult = await this.secretsRepository.getDecryptedToken();
      if (!tokenResult.success) {
        return err('Unknown');
      }

      const encodedTag = encodeURIComponent(clanTag);
      const url = `${this.baseUrl}/clans/${encodedTag}/currentwar`;

      const response = await this.httpClient.fetch(url, {
        headers: {
          Authorization: `Bearer ${tokenResult.value}`,
          Accept: 'application/json',
        },
        timeout: this.timeoutMs,
      });

      if (response.status !== 200) {
        return err(classifyCocError(response.status));
      }

      const json = await response.json();
      return ok(mapWar(json));
    } catch {
      return err('Unknown');
    }
  }
}
