import { type Page } from '@playwright/test';

/** Helpers transverses — pas de logique métier ici. */

/** Sauvegarde l'état de session du contexte courant (cookies + localStorage). */
export async function saveSession(page: Page, path: string): Promise<void> {
  await page.context().storageState({ path });
}

/** Vide l'état client (à utiliser en teardown de fixture, pas en afterEach). */
export async function clearClientState(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.context().clearCookies();
}

/** Slug fs-friendly pour nommer les fichiers de spec depuis un titre de scénario. */
export function toFileSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
