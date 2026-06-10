# Page Object Model

> Source: testdino-hq/playwright-skill (MIT) — pom/page-object-model.md
> **When to use**: Any page or component is touched by more than one test file, or a single test file interacts with more than two distinct UI regions.

Page objects encapsulate **actions**, not locators. A test should read like a user story: `await loginPage.login('admin', 'secret')`, never `await loginPage.usernameInput.fill('admin')`. The POM is a boundary between "what the user does" and "how the UI is structured." Assertions stay in tests, never inside page objects.

## Quick Reference

| Concept | Rule |
|---|---|
| Locators | Defined as `readonly` properties in the constructor or as getters. Never exposed raw to tests. |
| Actions | Public methods that perform a user-visible behavior. Return `Promise<void>` or the next page object. |
| Assertions | **Never** inside page objects. Tests own all `expect()` calls. |
| Navigation | Methods that navigate return the destination page object, not `void`. |
| State | Page objects are stateless. No caching locator text, no tracking "current step." |
| Constructor | Takes `Page` (or `Locator` for components). Nothing else. No URLs, no test data. |
| Naming | `LoginPage`, `DashboardPage`, `NavbarComponent`. File: `login.page.ts`, `navbar.component.ts`. |

## Patterns

### 1. Basic POM Class

**Use when**: A page has 3+ interactions across multiple tests.
**Avoid when**: A page is used in a single test file with trivial interactions -- use a helper function instead.

```typescript
// pages/login.page.ts
import { type Page, type Locator } from '@playwright/test';

export class LoginPage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(private readonly page: Page) {
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
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
}
```

**Test usage**

```typescript
import { test, expect } from '../fixtures/pages.fixture';

test('successful login redirects to dashboard', async ({ loginPage, page }) => {
  await loginPage.goto();
  await loginPage.login('admin', 'password123');
  await expect(page).toHaveURL('/dashboard');
});
```

### 2. Component Objects

**Use when**: A UI element (navbar, sidebar, modal, form, table) appears on multiple pages.

Components take a `Locator` (their root container), not a `Page`. This scopes all queries to the component's DOM subtree and allows composing components into page objects.

```typescript
// pages/components/modal.component.ts
import { type Locator } from '@playwright/test';

export class ModalComponent {
  readonly title: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;

  constructor(private readonly root: Locator) {
    this.title = root.getByRole('heading');
    this.confirmButton = root.getByRole('button', { name: 'Confirm' });
    this.cancelButton = root.getByRole('button', { name: 'Cancel' });
  }

  async confirm() { await this.confirmButton.click(); }
  async cancel() { await this.cancelButton.click(); }
}

// pages/dashboard.page.ts — composition
export class DashboardPage {
  readonly deleteModal: ModalComponent;

  constructor(private readonly page: Page) {
    this.deleteModal = new ModalComponent(page.getByRole('dialog'));
  }

  async deleteItem(name: string) {
    await this.page.getByRole('row', { name }).getByRole('button', { name: 'Delete' }).click();
    await this.deleteModal.confirm();
  }
}
```

### 3. Page Object with Navigation

When a method causes navigation, return the destination page object. This creates a typed chain that mirrors the user flow.

```typescript
export class LoginPage {
  constructor(private readonly page: Page) {}

  /** Returns DashboardPage on success. Call only when credentials are valid. */
  async loginAs(username: string, password: string): Promise<DashboardPage> {
    await this.page.getByLabel('Username').fill(username);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
    await this.page.waitForURL('/dashboard');
    return new DashboardPage(this.page);
  }

  /** Use for invalid credential tests -- stays on login page. */
  async loginExpectingError(username: string, password: string) {
    await this.page.getByLabel('Username').fill(username);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
  }
}
```

### 4. Page Object as Fixture (recommended for mature suites)

Fixtures eliminate boilerplate instantiation and make POMs available via destructuring.

```typescript
// fixtures/pages.fixture.ts
import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';

type PageObjects = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
};

export const test = base.extend<PageObjects>({
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
  dashboardPage: async ({ page }, use) => { await use(new DashboardPage(page)); },
});

export { expect } from '@playwright/test';
```

### 5. Getter Pattern for Dynamic Locators

**Use when**: Locators depend on dynamic content (parameterized rows, nth items, content that changes after page load). Getters create the locator fresh on each access.

```typescript
export class UsersPage {
  constructor(private readonly page: Page) {}

  get addUserButton(): Locator {
    return this.page.getByRole('button', { name: 'Add user' });
  }

  /** Dynamic locator -- must be a method since it takes a parameter. */
  userRow(name: string): Locator {
    return this.page.getByRole('row', { name });
  }

  async deleteUser(name: string) {
    await this.userRow(name).getByRole('button', { name: 'Delete' }).click();
    await this.userRow(name).waitFor({ state: 'hidden' });
  }
}
```

### 6. Async Initialization

Never put `await` in a constructor. Use a static factory method instead.

```typescript
export class AnalyticsPage {
  private constructor(private readonly page: Page) {
    this.chart = page.locator('[data-testid="analytics-chart"]');
  }

  static async create(page: Page): Promise<AnalyticsPage> {
    const analyticsPage = new AnalyticsPage(page);
    await page.goto('/analytics');
    await analyticsPage.chart.waitFor({ state: 'visible' });
    return analyticsPage;
  }
}
```

## Decision Guide

```
How complex is the page?
├── 1-2 interactions, single test file        → No POM, inline locators
├── 3-5 interactions OR 2+ test files         → Factory function or POM class
├── Used across 3+ test files                 → POM class + fixture injection
└── Page requires async setup before usable   → Static factory method + fixture
```

## Anti-Patterns

- **God Object** : une classe pour toute l'app / 30+ méthodes → une classe par page logique, composants composés.
- **Assertions dans les POM** : les `expect()` appartiennent aux tests. Exception : `waitForURL()`/`waitFor()` = synchronisation, pas assertion.
- **Héritage profond** (`BasePage → AuthenticatedPage → AdminPage`) → préférer la composition (`has-a` plutôt que `is-a`).
- **État stocké dans le POM** (compteurs, flags) → lire l'état depuis le DOM, le page est la source de vérité.
- **Locators bruts comme API principale** : exposer des `readonly` pour les assertions est OK ; obliger les tests à orchestrer des interactions multi-étapes via les locators ne l'est pas.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Locator times out but element exists | POM constructed before navigation | Move `goto()` before POM construction, or getter pattern |
| Circular import between page objects | A imports B imports A | Lazy `import()` in navigation method, or test creates destination POM |
| Fixture not available in test | `test` imported from `@playwright/test` | Import `test`/`expect` from the custom fixtures file |
| TS: property does not exist on fixture | Type missing in `test.extend<>()` generic | Add the POM type to the generic parameter |
| `goto()` in constructor fails | Constructors cannot be async | Static factory method |
