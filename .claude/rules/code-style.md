# Règles — Style de code

- TypeScript strict exclusivement : `.spec.ts` et `.ts`, jamais `.js`.
- Nommage : `LoginPage` dans `pages/login.page.ts` ; composants
  `NavbarComponent` dans `pages/components/navbar.component.ts` ;
  specs `tests/<feature>/<feature>.<flux>.spec.ts`.
- Une classe par fichier, pas de barrel files (`index.ts` ré-exportant tout).
- POM : tous les locators dans le constructeur (ou getters pour le dynamique),
  actions publiques, AUCUNE assertion dans les POM, composition plutôt
  qu'héritage. Référence : skill `playwright-best-practices`.
- Assertions toujours avec message explicite :
  `expect(locator, 'message explicite').toBeVisible()`.
- Un commentaire de traçabilité par test : `// @scenario {scenario_id}` +
  le texte de l'étape en commentaire avant chaque bloc d'actions.
- Imports : `{ test, expect }` depuis `fixtures/pages.fixture.ts`, jamais
  depuis `@playwright/test` dans les specs.
- `npm run typecheck` doit passer avant toute livraison de code.
