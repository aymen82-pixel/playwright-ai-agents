# Authentication Testing

> Source: testdino-hq/playwright-skill (MIT) — core/authentication.md (édition TypeScript).
> **When to use**: Any app with login, sessions or protected routes. Authentication is the most common source of slow test suites.

## Quick Reference

```typescript
// Storage state reuse — the #1 pattern for fast auth
await page.goto('/login');
await page.getByLabel('Email').fill('user@test.com');
await page.getByLabel('Password').fill('password');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.context().storageState({ path: '.auth/user.json' });

// Reuse in config — every test starts authenticated
{ use: { storageState: '.auth/user.json' } }

// API login — skip the UI entirely (5-10x faster)
const response = await context.request.post('/api/auth/login', {
  data: { email: 'user@test.com', password: 'password' },
});
await context.storageState({ path: '.auth/user.json' });
```

## Patterns

### Storage State Reuse (pattern par défaut)

`storageState` sérialise cookies + localStorage dans un JSON, rechargé dans n'importe quel contexte → départ authentifié instantané.

```typescript
// global-setup.ts
import { chromium, type FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();

  await page.goto(`${baseURL}/login`);
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL!);
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');

  await page.context().storageState({ path: '.auth/user.json' });
  await browser.close();
}
export default globalSetup;
```

```typescript
// playwright.config.ts
export default defineConfig({
  globalSetup: require.resolve('./global-setup'),
  use: { baseURL: 'http://localhost:3000', storageState: '.auth/user.json' },
});
```

**Important** : `.auth/` dans `.gitignore` — les fichiers de session contiennent des tokens.

### In-Place Refresh — `context.setStorageState()` (Playwright 1.59+)

Remplace cookies/localStorage/IndexedDB sans recréer le contexte :

```typescript
await context.setStorageState('.auth/admin.json');
await page.reload();
```

### Multiple Roles (un projet par rôle)

```typescript
// global-setup : boucle sur les rôles → .auth/{role}.json
// playwright.config.ts
projects: [
  { name: 'admin',  use: { storageState: '.auth/admin.json' },  testMatch: '**/*.admin.spec.ts' },
  { name: 'user',   use: { storageState: '.auth/user.json' },   testMatch: '**/*.user.spec.ts' },
  { name: 'unauthenticated', use: { storageState: { cookies: [], origins: [] } }, testMatch: '**/*.anon.spec.ts' },
],
```

Alternative dans un même spec : fixture `loginAs(role)` qui ouvre un contexte par rôle depuis `.auth/{role}.json` et ferme tout au teardown.

### Per-Worker Authentication

Quand les tests mutent l'état utilisateur : session isolée par worker.

```typescript
export const test = base.extend<{}, { authenticatedContext: BrowserContext }>({
  authenticatedContext: [async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/login');
    await page.getByLabel('Email').fill(`worker-${test.info().parallelIndex}@test.com`);
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/dashboard');
    await page.close();
    await use(context);
    await context.close();
  }, { scope: 'worker' }],
});
```

### Session Refresh (tokens courts)

Fixture qui vérifie la validité avant usage et ré-authentifie si expiré :

```typescript
authenticatedPage: async ({ browser }, use) => {
  const statePath = '.auth/user.json';
  if (fs.existsSync(statePath)) {
    const context = await browser.newContext({ storageState: statePath });
    const page = await context.newPage();
    const res = await page.request.get('/api/auth/me');   // health check session
    if (res.ok()) { await use(page); await context.close(); return; }
    await context.close();
  }
  // ré-authentification UI + sauvegarde du state rafraîchi
  // ... login ... await context.storageState({ path: statePath });
},
```

### API-Based Login (le plus rapide)

```typescript
const requestContext = await request.newContext({ baseURL });
const response = await requestContext.post('/api/auth/login', {
  data: { email: process.env.TEST_USER_EMAIL!, password: process.env.TEST_USER_PASSWORD! },
});
if (!response.ok()) throw new Error(`API login failed: ${response.status()}`);
await requestContext.storageState({ path: '.auth/user.json' });
```

### OAuth/SSO Mocking

Ne jamais frapper le vrai provider en CI. Intercepter le callback :

```typescript
await page.route('https://accounts.google.com/**', async (route) => {
  const cb = new URL('http://localhost:3000/auth/callback');
  cb.searchParams.set('code', 'mock-auth-code-12345');
  await route.fulfill({ status: 302, headers: { location: cb.toString() } });
});
```

Ou injection de session via endpoint test-only (`NODE_ENV=test` uniquement, jamais en prod).

### MFA

1. Générer de vrais codes TOTP depuis un secret partagé (lib `otpauth`) — le plus fiable.
2. Code bypass accepté par le backend en mode test (`000000`).
3. Désactiver le MFA sur les comptes de test (le plus simple, mais tester le flux MFA au moins une fois).

### Tests non authentifiés

```typescript
test.use({ storageState: { cookies: [], origins: [] } });

test('protected route redirects to login', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForURL('**/login**');
  expect(page.url()).toContain('redirect=%2Fdashboard');
});
```

## Decision Guide

```
Tester la page de login elle-même ?
├── Oui → login UI avec LoginPage POM, sans storageState
└── Non → Endpoint API de login disponible ?
    ├── Oui → API login en global setup, storageState (le plus rapide)
    └── Non → login UI en global setup, storageState
              └── Tokens à expiration courte ? → fixture de refresh
Tests qui mutent l'état utilisateur ? → fixture per-worker + comptes per-worker
Plusieurs rôles ? → un projet Playwright par rôle
```

## Anti-Patterns

| Don't | Do |
|---|---|
| Login UI avant chaque test (2-5 s × 200 tests) | `storageState`, login une fois |
| State partagé entre workers qui mutent | fixtures `{ scope: 'worker' }`, comptes par worker |
| Credentials en dur dans les tests | variables d'environnement |
| Ignorer l'expiration des tokens | check de validité + ré-auth dans la fixture |
| Vrai OAuth en CI | mock du callback / injection API |
| `waitForTimeout(2000)` après login | `waitForURL('/dashboard')` |
| `.auth/*.json` dans git | `.gitignore`, générer en CI |
| Compte "dieu" unique | un compte par rôle pour tester le RBAC |

## Troubleshooting

- **Global setup : "Target closed"** → `waitForURL()` après login ; vérifier `baseURL` (protocole inclus).
- **401 après un moment** → token expiré : fixture de refresh ou expiry allongé en env de test.
- **storageState vide** → appelé avant que le cookie soit posé : attendre la page post-login, vérifier `context.cookies()` non vide avant sauvegarde.
- **Sessions qui interfèrent en parallèle** → comptes per-worker (`worker-${parallelIndex}@test.com`).
- **Mock OAuth ignoré** → `page.route()` AVANT `page.goto()` ; logger les URLs pour vérifier le pattern.
