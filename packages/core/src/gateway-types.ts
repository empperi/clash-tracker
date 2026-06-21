export type CocApiError =
  | 'RateLimited'
  | 'Unauthorized'
  | 'IpNotWhitelisted'
  | 'NotFound'
  | 'Maintenance'
  | 'Unknown';

/**
 * Maps HTTP status codes from the Clash of Clans API to typed CocApiError strings.
 */
export function classifyCocError(status: number): CocApiError {
  switch (status) {
    case 401:
      return 'Unauthorized';
    case 403:
      return 'IpNotWhitelisted';
    case 404:
      return 'NotFound';
    case 429:
      return 'RateLimited';
    case 503:
      return 'Maintenance';
    default:
      return 'Unknown';
  }
}

export interface HttpResponse {
  readonly status: number;
  json(): Promise<unknown>;
}

export interface HttpClient {
  fetch(
    url: string,
    init?: {
      headers?: Record<string, string>;
      timeout?: number;
      method?: string;
      body?: string;
    }
  ): Promise<HttpResponse>;
}
