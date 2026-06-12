# Fixtures and Hooks

> Source: testdino-hq/playwright-skill (MIT) — core/fixtures-and-hooks.md (édition TypeScript).
> **When to use**: Whenever tests need shared setup, teardown, reusable resources, or configurable context. Fixtures are Playwright's killer feature — prefer them over hooks.

## Quick Reference

| Mechanism | Scope | Cleanup guaranteed? | Use for |
|---|---|---|---|
| `test.extend()` fixture | per-test | Yes (via `use()`) | Most setup/teardown needs |
| Worker-scoped fixture | per-worker | Yes | Expensive resources: DB connections, auth state |
| Auto fixture | test or worker | Yes | Side effects that must always run (block analytics, capture errors) |
| `beforeEach`/`afterEach` | per-test | No (`afterEach` skipped on crash) | Simple setup without cleanup |
| `beforeAll`/`afterAll` | per-worker | No | Read-only checks only; dangerous with shared state |

**The rule**: if it needs cleanup, use a fixture. When in doubt, use a fixture.

## Patterns

### 1. Custom Test Fixture

Everything before `use()` is setup; everything after is teardown. Teardown runs even if the test crashes.

```typescript
// fixtures/pages.fixture.ts
import { test as base, expect } from '@playwright/test';

type TodoFixtures = { todoPage: TodoPage };

export const test = base.extend<TodoFixtures>({
  todoPage: async ({ page }, use) => {
    await page.goto('/todos');                      // setup
    await use(new TodoPage(page));                  // hand to test
    await page.evaluate(() => localStorage.clear()); // teardown — toujours exécuté
  },
});
export { expect };
```

### 2. Worker-Scoped Fixtures

Created once per worker. Cannot depend on test-scoped fixtures (`page`, `context`). Second generic argument of `extend<Test, Worker>`.

```typescript
export const test = base.extend<{}, { authToken: string }>({
  authToken: [async ({}, use) => {
    const res = await fetch(`${process.env.API_URL}/auth/token`, {
      method: 'POST',
      body: JSON.stringify({ username: 'test-user', password: process.env.TEST_PASSWORD }),
      headers: { 'Content-Type': 'application/json' },
    });
    const { token } = await res.json();
    await use(token);
  }, { scope: 'worker' }],
});
```

### 3. Auto Fixtures

Run for every test without being requested. `{ auto: true }` (+ `scope: 'worker'` possible).

```typescript
export const test = base.extend<{ blockAnalytics: void; consoleErrors: string[] }>({
  blockAnalytics: [async ({ page }, use) => {
    await page.route(/google-analytics|segment|hotjar|mixpanel/, r => r.abort());
    await use();
  }, { auto: true }],

  consoleErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await use(errors);
    if (errors.length) throw new Error(`Unexpected console errors:\n${errors.join('\n')}`);
  }, { auto: true }],
});
```

### 4. Composition with `mergeTests()`

One fixture file per domaine (auth, api, pages), combinés :

```typescript
// fixtures/index.ts
import { mergeTests } from '@playwright/test';
import { test as authTest } from './auth.fixture';
import { test as apiTest } from './api.fixture';

export const test = mergeTests(authTest, apiTest);
export { expect } from '@playwright/test';
```

### 5. Option Fixtures (paramétrables)

`{ option: true }` → surchargables dans `playwright.config` (`use`) ou `test.use()` au niveau describe.

```typescript
export const test = base.extend<{ userRole: 'admin' | 'editor' | 'viewer' }>({
  userRole: ['viewer', { option: true }],
  authenticatedPage: async ({ page, userRole }, use) => {
    // login avec les credentials du rôle (depuis variables d'environnement)
    await use(page);
  },
});

// par projet : projects: [{ name: 'admin-tests', use: { userRole: 'admin' } }]
// par describe : test.describe(...) { test.use({ userRole: 'admin' }); ... }
```

### 6. Fixture Dependencies

Demander une fixture par son nom dans l'argument destructuré ; Playwright résout le graphe. Teardown en ordre inverse des dépendances.

```typescript
export const test = base.extend<Fixtures>({
  apiContext: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({ baseURL: process.env.API_URL });
    await use(ctx);
    await ctx.dispose();
  },
  testUser: async ({ apiContext }, use) => {
    const res = await apiContext.post('/test/users', { data: { email: `user-${Date.now()}@test.com` } });
    const user = await res.json();
    await use(user);
    await apiContext.delete(`/test/users/${user.id}`);   // cleanup garanti
  },
  userPage: async ({ page, testUser }, use) => {
    // login avec testUser puis await use(page)
  },
});
```

### 7. Overriding Built-in Fixtures

Quand TOUS les tests ont besoin de la même modification de `page`/`context` :

```typescript
export const test = base.extend({
  context: async ({ browser }, use) => {
    const context = await browser.newContext({
      extraHTTPHeaders: { 'X-Test-ID': `test-${Date.now()}` },
    });
    await use(context);
    await context.close();
  },
});
```

### 8. Multi-rôles via storageState

```typescript
export const test = base.extend<{ adminPage: Page; editorPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: 'auth/admin.json' });
    await use(await ctx.newPage());
    await ctx.close();
  },
  editorPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: 'auth/editor.json' });
    await use(await ctx.newPage());
    await ctx.close();
  },
});
```

### 9. Hooks acceptables

`beforeEach` pour navigation simple sans teardown. `beforeAll` uniquement pour des checks lecture seule (health check) — il ne reçoit que les fixtures worker (`request`, `browser`), jamais `page`.

## Decision Guide

```
Besoin de cleanup ?            → fixture (use() pattern)
  Ressource chère partageable  → { scope: 'worker' }
  Doit tourner partout         → { auto: true }
  Configurable par projet      → { option: true }
Pas de cleanup et trivial      → beforeEach acceptable
Fixtures multi-domaines        → mergeTests()
```

## Anti-Patterns

- **État mutable global dans `beforeAll`** : casse le parallélisme, cleanup non garanti → fixture worker-scoped.
- **Cleanup dans `afterEach`** : non exécuté en cas de crash → teardown après `use()`.
- **Fixture fourre-tout** (login + data + routes + locale) → une responsabilité par fixture.
- **Sur-abstraction** (factories de fixtures à tiroirs) → fixtures explicites, ennuyeuses, lisibles.
- **Fixtures non typées** → toujours `extend<Interface>` pour autocomplete et erreurs compile-time.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Cannot use a test-scoped fixture in a worker-scoped fixture" | Worker fixtures ne dépendent que de worker fixtures (`browser`, `playwright`) |
| Teardown ne tourne pas | Déplacer le cleanup après `await use()` |
| `beforeAll` n'a pas `page` | `page` est test-scoped → fixture ou `beforeEach` |
| Test bloqué dans la fixture | `await use(value)` jamais appelé — chaque chemin doit l'appeler exactement une fois |
| La fixture tourne mais valeur absente | Déclarer la fixture dans la signature du test |
| `test.use()` ignoré | Doit être au top-level d'un describe/fichier, pas dans un test |
| Auto fixture ne tourne pas | Importer `test` depuis le fichier de fixtures, pas `@playwright/test` |
