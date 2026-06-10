# Quick Start — Plateforme QA Autonome

Les agents sont installés dans `.claude/agents/` et prêts à l'emploi.

## 1. Installer les dépendances

```bash
npm install
npx playwright install
```

## 2. Configurer le projet cible

```bash
cp .qa/qa.config.example.json .qa/qa.config.json
```

Renseigner dans `.qa/qa.config.json` : `base_url`, les rôles (noms des
variables d'environnement), les routes exclues, et si besoin
`test_management_tool` (xray | zephyr | testrail).

## 3. Exporter les credentials

```bash
# PowerShell
$env:QA_DEFAULT_USER = "user@example.com"
$env:QA_DEFAULT_PASSWORD = "********"

# bash
export QA_DEFAULT_USER=user@example.com QA_DEFAULT_PASSWORD=********
```

Jamais de credentials en dur — tout passe par `utils/test-data.ts` + env.

## 4. Lancer une campagne complète

Dans Claude Code :

```
/qa-campaign
```

ou en langage naturel : « Lance une campagne QA complète sur l'application ».
Le QA Analyst enchaîne : couverture (Agent 0) → découverte (Agent 1) →
parcours (Agent 2) → automatisation (Agent 4) → exécution (Agent 5) →
healing (Agent 6 si nécessaire).

## Usages ciblés

| Besoin | Commande |
|---|---|
| Voir les zones non couvertes sans rien générer | `/qa-coverage` |
| Réparer des tests cassés | `/qa-heal` ou `/qa-heal tests/<feature>/` |
| Livrables manuels (Gherkin + CSV Xray) | demander explicitement l'Agent 3 : « Génère les cas de test manuels du domaine X » |

## 5. Exécuter et vérifier

```bash
npm test                # suite complète
npm run test:chromium   # un seul navigateur
npm run typecheck       # compilation TS (obligatoire avant livraison)
npm run report          # rapport HTML Playwright
```

## Où vont les livrables

- Tests générés : `tests/<feature>/<feature>.<flux>.spec.ts`
- Page objects : `pages/`, fixtures : `fixtures/pages.fixture.ts`
- Livrables de campagne (JSON + log) : `.qa/runs/{run_id}/`
- Mémoire persistante (sélecteurs, sessions, couverture) : `.qa/agentdb/`
- Exemples de plans de test : `examples/test-plans/`

Architecture détaillée : [ARCHITECTURE.md](ARCHITECTURE.md).
