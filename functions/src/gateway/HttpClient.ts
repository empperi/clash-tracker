import { HttpClient } from '@clash-tracker/core';

export const nodeHttpClient: HttpClient = {
  fetch: async (url, init) => {
    const controller = init?.timeout ? new AbortController() : null;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (controller && init?.timeout) {
      timeoutId = setTimeout(() => controller.abort(), init.timeout);
    }
    try {
      const res = await fetch(url, {
        method: init?.method || 'GET',
        headers: init?.headers,
        body: init?.body,
        signal: controller?.signal,
      });
      return {
        status: res.status,
        json: () => res.json(),
      };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  },
};
