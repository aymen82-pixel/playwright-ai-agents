# Règles — Tests

- Organisation par feature : `tests/<feature>/` ; un `describe` par
  fonctionnalité ; titre du test = nom du scénario source.
- Chaque test autonome et idempotent : aucun ordre d'exécution requis,
  données uniques via `uniqueId()` de `utils/test-data.ts`.
- Interdits absolus : `waitForTimeout`, `networkidle`, URL en dur,
  credentials en dur, `test.only` committé.
- Attentes : assertions web-first auto-retry, `waitForURL`, `waitForResponse`.
- Créations de données : vérifier via la réponse API (`POST → 201` avec
  `waitForCreation()` de `utils/api-client.ts`), pas par scraping de tableau ;
  suffixer les données `TestE2E-{Date.now()}`.
- Authentification : storageState réutilisé (`.qa/agentdb/sessions/`),
  jamais de login UI répété par test. Tests du login lui-même :
  `test.use({ storageState: { cookies: [], origins: [] } })`.
- Couverture minimale par fonctionnalité : 1 nominal + 1 erreur.
- Tests flaky : diagnostiquer (taxonomie du skill `playwright-best-practices`,
  `references/flaky-tests.md`) ; quarantaine `test.fixme()` + raison + ticket,
  jamais d'augmentation aveugle de timeout.
- Retries : 2 en CI, 0 en local ; traces `on-first-retry`.
