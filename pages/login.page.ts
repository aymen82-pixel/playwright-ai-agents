import { type Page, type Locator } from '@playwright/test';

/**
 * POM générique de page de login.
 * Convention projet : une classe par page, tous les locators dans le
 * constructeur, actions publiques, AUCUNE assertion (les expect() vivent
 * dans les tests). Voir .claude/skills/playwright-best-practices.
 */
export class LoginPage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(private readonly page: Page) {
    this.usernameInput = page.getByRole('textbox').first();
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.getByRole('button', { name: /sign in|log ?in|se connecter/i });
    this.errorMessage = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  /** Variante pour les tests d'erreur — reste sur la page de login. */
  async loginExpectingError(username: string, password: string) {
    await this.login(username, password);
  }
}
