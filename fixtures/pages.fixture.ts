import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

/**
 * Fixtures POM du projet.
 * Tous les specs importent { test, expect } depuis CE fichier,
 * jamais depuis '@playwright/test'.
 * L'Agent 4 (qa-automation-engineer) ajoute ici chaque nouveau POM (Edit,
 * jamais d'écrasement complet).
 */
type PageObjects = {
  loginPage: LoginPage;
};

export const test = base.extend<PageObjects>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});

export { expect } from '@playwright/test';
