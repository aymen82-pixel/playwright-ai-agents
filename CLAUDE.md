# Plateforme QA Autonome — Instructions équipe

Plateforme de test multi-agents agnostique au métier : 7 agents spécialisés
orchestrés par `qa-analyst` produisent couverture, parcours, scénarios, tests
Playwright, exécution et auto-réparation.

## Structure du projet

```
.claude/            # agents (qa-analyst + 0–6 + spécialistes a11y/compliance), skills, commands, rules, hooks, settings.json
.claude-plugin/     # marketplace.json — ce repo est installable comme plugin
qa-mesh-plugin/     # plugin distribuable : agents + skills + hooks + MCP (voir son README)
.qa/                # config projet, contrats JSON inter-agents, AgentDB (mémoire persistante)
tests/              # specs Playwright organisés PAR FEATURE : tests/<feature>/<feature>.<flux>.spec.ts
pages/              # Page Object Model : une classe par page (<nom>.page.ts), composants dans pages/components/
fixtures/           # fixtures custom — tout spec importe { test, expect } depuis fixtures/pages.fixture.ts
utils/              # helpers, test-data (credentials via env), client API
examples/           # exemples de plans de test
ARCHITECTURE.md     # architecture détaillée des agents, diagramme, stratégie MCP
```

## Règles non négociables

- Lire et appliquer `.claude/rules/` : `code-style.md`, `testing.md`, `selectors.md`.
- TypeScript exclusivement. Compilation `npm run typecheck` obligatoire avant livraison.
- Jamais d'URL en dur (utiliser `baseURL`), jamais de credentials en dur
  (utiliser `utils/test-data.ts` + variables d'environnement).
- Jamais `waitForTimeout` ni `networkidle`. Ces interdits (+ `test.only`,
  URL/credentials en dur) sont appliqués automatiquement par les hooks
  `.claude/hooks/qa-guard.js` (blocage à l'écriture) et `qa-typecheck.js`
  (compilation TS après chaque écriture).
- Ne pas modifier `utils/test-data.ts` ni `playwright.config.ts` sans demande explicite.
- Toute donnée spécifique au projet testé vit dans `.qa/qa.config.json` — aucun
  agent ne contient de règle métier.

## Lancer une campagne QA

1. `cp .qa/qa.config.example.json .qa/qa.config.json` puis renseigner base_url et rôles.
2. Exporter les credentials (`QA_DEFAULT_USER`, `QA_DEFAULT_PASSWORD`, …).
3. Invoquer l'agent `qa-analyst` (ou `/qa-campaign`). Phases : couverture →
   découverte → parcours → [conception sur demande] → automatisation →
   exécution → healing. Détails : `ARCHITECTURE.md`.

## Commandes

- `npm test` — suite complète ; `npm run test:chromium` — un seul navigateur
- `npm run typecheck` — validation TS sans émission
- `/qa-campaign`, `/qa-coverage`, `/qa-heal` — workflows agents
