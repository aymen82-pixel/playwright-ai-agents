import { request, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { ZodType, z } from 'zod';

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

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface TypedRequestOptions<TSchema extends ZodType> {
  schema: TSchema;
  data?: unknown;
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
}

export interface TypedResponse<TSchema extends ZodType> {
  status: number;
  body: z.infer<TSchema>;
  raw: APIResponse;
}

/**
 * Appel API typé — valide la réponse contre un schéma Zod avant de la
 * renvoyer. Un contrat rompu doit faire échouer le test avec le diff Zod,
 * jamais être avalé silencieusement (cf. cartographie des endpoints Nova —
 * distinguer un vrai défaut d'un cas particulier attendu).
 */
export async function typedRequest<TSchema extends ZodType>(
  context: APIRequestContext,
  method: HttpMethod,
  url: string,
  { schema, data, params, headers }: TypedRequestOptions<TSchema>,
): Promise<TypedResponse<TSchema>> {
  const raw = await context.fetch(url, { method, data, params, headers });
  const status = raw.status();
  const json = status === 204 ? undefined : await raw.json().catch(() => undefined);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Réponse ${method} ${url} (HTTP ${status}) non conforme au schéma attendu :\n${parsed.error.toString()}`,
    );
  }
  return { status, body: parsed.data, raw };
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
