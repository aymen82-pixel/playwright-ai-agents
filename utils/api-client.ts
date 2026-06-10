import { request, type APIRequestContext } from '@playwright/test';

/**
 * Client API réutilisable (login API, seed/cleanup de données,
 * vérifications de réponses serveur).
 */
export async function createApiContext(options?: {
  baseURL?: string;
  token?: string;
}): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: options?.baseURL ?? process.env.API_URL ?? process.env.BASE_URL,
    extraHTTPHeaders: options?.token
      ? { Authorization: `Bearer ${options.token}` }
      : undefined,
  });
}

/** Attend la réponse de création (POST → 201) — préférer ceci au scraping de tableau. */
export function waitForCreation(page: import('@playwright/test').Page, endpointPattern: string | RegExp) {
  return page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      (typeof endpointPattern === 'string'
        ? r.url().includes(endpointPattern)
        : endpointPattern.test(r.url())) &&
      r.status() === 201,
  );
}
