import { test as base } from '@playwright/test';
import type { ZodType } from 'zod';
import { LoginPage } from '../pages/login.page';
import {
  createApiContext,
  typedRequest,
  type HttpMethod,
  type TypedRequestOptions,
  type TypedResponse,
} from '../utils/api-client';

/**
 * Fixtures POM + API du projet.
 * Tous les specs importent { test, expect } depuis CE fichier,
 * jamais depuis '@playwright/test'.
 * L'Agent 4 (qa-automation-engineer) ajoute ici chaque nouveau POM (Edit,
 * jamais d'écrasement complet).
 */
type PageObjects = {
  loginPage: LoginPage;
};

/**
 * Requête API typée, validée par schéma Zod (voir schemas/). Contexte
 * indépendant de use.baseURL — pointe vers NOVA_API_URL, distinct de la
 * cible UI du projet.
 */
export type ApiRequest = <TSchema extends ZodType>(
  method: HttpMethod,
  url: string,
  options: TypedRequestOptions<TSchema>,
) => Promise<TypedResponse<TSchema>>;

type ApiFixtures = {
  apiRequest: ApiRequest;
};

export const test = base.extend<PageObjects & ApiFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  apiRequest: async ({}, use) => {
    const context = await createApiContext({
      baseURL: process.env.NOVA_API_URL,
      token: process.env.NOVA_API_TOKEN,
    });
    await use((method, url, options) => typedRequest(context, method, url, options));
    await context.dispose();
  },
});

export { expect } from '@playwright/test';
