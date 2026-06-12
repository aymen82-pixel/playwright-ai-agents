# Flaky Tests

> Source: testdino-hq/playwright-skill (MIT) — core/flaky-tests.md (édition TypeScript).
> **When to use**: A test passes sometimes and fails other times. Diagnose the root cause, fix it, prevent it.

## Quick Reference

```bash
npx playwright test tests/checkout.spec.ts --repeat-each=10        # burn-in
npx playwright test --retries=3                                     # catch intermittents
npx playwright test --grep "adds item" --workers=1                  # isoler du suite
npx playwright test --retries=3 --trace=retain-on-failure-and-retries  # PW 1.59+
npx playwright test --fully-parallel --workers=4                    # exposer les pbs d'isolation
```

## Taxonomie — identifier la catégorie d'abord

| Category | Symptom | Root Cause | Diagnosis |
|---|---|---|---|
| **Timing / Async** | échoue partout, par intermittence | race conditions, `await` manquant, waits arbitraires | échoue en local avec `--repeat-each=20` |
| **Test Isolation** | échoue seulement avec d'autres tests | état partagé, collisions de données, dépendance d'ordre | passe avec `--workers=1 --grep`, échoue en suite |
| **Environment** | échoue seulement en CI | viewport, fonts, latence, machines lentes | comparer traces CI vs local |
| **Infrastructure** | aléatoire, sans rapport avec la logique | crash navigateur, OOM, DNS | erreurs internes navigateur, aucun pattern |

```
Échoue en local avec --repeat-each=20 ?     → TIMING
Sinon, échoue seulement en CI ?             → ENVIRONMENT
Sinon, échoue seulement en suite complète ? → ISOLATION
Sinon                                        → INFRASTRUCTURE
```

## Fixes

### Timing / Async

```typescript
// FIX 1 — remplacer waitForTimeout par une assertion auto-retry
await page.getByRole('button', { name: 'Refresh' }).click();
await expect(page.getByTestId('data-table')).toBeVisible();   // jamais waitForTimeout(3000)

// FIX 2 — attendre la réponse API avant d'asserter
const responsePromise = page.waitForResponse(r => r.url().includes('/api/users') && r.status() === 200);
await page.getByRole('button', { name: 'Load More' }).click();
await responsePromise;
await expect(page.getByRole('listitem')).toHaveCount(20);

// FIX 3 — animations : toBeVisible attend la stabilité avant d'interagir
await page.getByRole('button', { name: 'Open' }).click();
await expect(page.getByRole('dialog')).toBeVisible();
await page.getByRole('button', { name: 'Confirm' }).click();

// FIX 4 — toPass() pour un bloc multi-étapes à réessayer entièrement
await expect(async () => {
  await page.getByLabel('Search').fill('playwright');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByTestId('result-count')).toHaveText('10 results');
}).toPass({ timeout: 15_000, intervals: [1_000, 2_000, 5_000] });
```

### Isolation

```typescript
// FIX 1 — données uniques par test
const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

// FIX 2 — ressources chères : fixture worker-scoped avec cleanup
workerAccount: [async ({ request }, use) => {
  const response = await request.post('/api/users', { data: { email, password: '...' } });
  const account = await response.json();
  await use(account);
  await request.delete(`/api/users/${account.id}`);
}, { scope: 'worker' }],

// FIX 3 — nettoyer l'état client en teardown de fixture
await use(page);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.context().clearCookies();

// FIX 4 — describe.serial UNIQUEMENT pour des étapes réellement dépendantes (wizard)
```

### Environment

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    contextOptions: { reducedMotion: 'reduce' },          // désactiver les animations
    viewport: { width: 1280, height: 720 },               // viewport explicite local = CI
  },
  webServer: { command: 'npm run start', url: 'http://localhost:3000',
               reuseExistingServer: !process.env.CI, timeout: 120_000 },
  timeout: process.env.CI ? 60_000 : 30_000,
  expect: { timeout: process.env.CI ? 10_000 : 5_000 },
});

// Auto-fixture : stubber les services externes variables
stubExternals: [async ({ page }, use) => {
  await page.route(/google-analytics|segment|hotjar|intercom/, r => r.abort());
  await page.route('**/api.external-service.com/**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', data: [] }) }));
  await use();
}, { auto: true }],
```

## Détection

- **Burn-in** : `--repeat-each=20` en local (jamais en CI sur chaque commit).
- **Retries CI** : `retries: process.env.CI ? 2 : 0` — pour DÉTECTER (compter les retries au rapport), pas pour masquer.
- **Reporter custom** : `onTestEnd` → si `result.retry > 0 && status === 'passed'` → test flaky à logger.
- **PW 1.60+** : `errorContext` (aria snapshot au moment de l'échec) à attacher dans `afterEach` quand `testInfo.status !== testInfo.expectedStatus`.

## Quarantaine

```typescript
test.fixme('checkout with promo code', async ({ page }) => {
  // TODO(JIRA-1234): race condition promo service — échoue ~10% des runs
});

test.fail('known broken: export to PDF', async ({ page }) => {
  // alerte quand ça REcommence à passer → retirer l'annotation
});

test('@flaky checkout race condition', async ({ page }) => {
  // CI : --grep-invert @flaky ; nightly : --grep @flaky --retries=5
});
```

## Prevention Checklist (config flake-resistant)

`fullyParallel: true` · `forbidOnly: !!process.env.CI` · `retries: CI ? 2 : 0` ·
timeouts raisonnables (30 s / expect 5 s) · `trace: 'on-first-retry'` · `baseURL`
(jamais d'URL en dur) · `reducedMotion: 'reduce'` · viewport explicite ·
`webServer` · données uniques par test · locators par rôle · assertions auto-retry.

## Anti-Patterns

| Don't | Problem | Do |
|---|---|---|
| Timeout à 120 s pour "réparer" | masque la cause, suite lente | corriger la race condition |
| `waitForTimeout(N)` | cause n°1 de flakiness | `expect().toBeVisible()`, `waitForResponse()`, `expect.poll()` |
| Ignorer ("relance et ça passe") | érode la confiance, vrais bugs ratés | diagnostiquer ; sinon `test.fixme()` + ticket |
| `--retries=3` = corrigé | cache le bug | retries pour détecter, pas pour masquer |
| `describe.serial()` contre l'ordre | cache le bug d'isolation | chaque test indépendant de l'ordre |
| Tout mocker | tests verts, app cassée | mocker uniquement les services tiers |

## Troubleshooting

| Symptom | Category | Fix |
|---|---|---|
| "Timeout 5000ms" intermittent | Timing | `expect.timeout` 10 s ou `waitForResponse()` avant l'assertion |
| Passe seul, échoue en suite | Isolation | variables module-level, lignes BD partagées, localStorage |
| Passe local, échoue CI | Environment | comparer traces ; viewport, fonts, reducedMotion, services externes |
| "Target closed" / "Browser closed" | Infrastructure | mémoire CI, `--workers=50%`, health check en `beforeAll` |
| Échec différent à chaque fois | Timing+Isolation | `trace: 'on'`, comparer plusieurs traces |
| Passe 99/100 | Timing (race rare) | `--repeat-each=200` local + `waitForResponse`/`expect.poll` ciblé |
| Visuel flaky | Environment | `maxDiffPixelRatio`, fonts fixées, Docker pour rendu constant |
