# Plateforme QA Autonome — Playwright multi-agents

Plateforme de test agnostique au métier : un orchestrateur (`qa-analyst`) pilote
7 agents spécialisés pour découvrir les zones non couvertes, explorer
l'application, générer parcours et scénarios, automatiser en Playwright
(POM/TypeScript), exécuter et auto-réparer les tests — avec un coût LLM minimal.

Compatible Claude Code, OpenCode, Codex, GitHub Copilot Agent Mode, Gemini CLI
et tout environnement MCP.

## Démarrage rapide

```bash
npm install && npx playwright install
cp .qa/qa.config.example.json .qa/qa.config.json   # renseigner base_url et rôles
export QA_DEFAULT_USER=... QA_DEFAULT_PASSWORD=...
```

Puis dans Claude Code : `/qa-campaign` (ou invoquer l'agent `qa-analyst`).
Guide pas à pas : [QUICKSTART.md](QUICKSTART.md).

## Mode opératoire pas à pas (débutant)

> Vous n'avez jamais utilisé la plateforme ? Suivez ces étapes dans l'ordre.
> Aucune connaissance de Playwright ou des agents n'est requise pour démarrer.

### Ce qu'il vous faut

- **Node.js ≥ 22.5** (le kernel utilise `node:sqlite` intégré) — vérifiez avec `node --version`.
- **Claude Code** ouvert dans ce dossier.
- L'**URL** de l'application web à tester et **un compte de test** (identifiant + mot de passe)
  que vous avez le droit d'utiliser.

### Étape 1 — Installer les dépendances

```bash
npm install && npx playwright install   # navigateurs Playwright
npm --prefix kernel ci                  # dépendances du kernel qa-mesh
npm --prefix kernel run build           # compile kernel/dist/ (les agents l'appellent)
```

> Le **kernel** est un petit programme qui fait le travail mécanique (validation,
> mémoire, priorisation) sans consommer de tokens. Il doit être compilé une fois.

### Étape 2 — Configurer le projet testé

```bash
cp .qa/qa.config.example.json .qa/qa.config.json
```

Ouvrez `.qa/qa.config.json` et renseignez **au minimum** :
- `base_url` : l'adresse de votre application (ex. `https://app.exemple.com`).
- `roles[].username_env` / `password_env` : les **noms** des variables d'environnement
  qui contiendront les identifiants (jamais les identifiants en clair dans le fichier).
- `auth.login_url` et `auth.steps` : comment se connecter (déjà pré-rempli, à adapter).

C'est le **seul** fichier contenant des données de votre projet. Les agents, eux, sont génériques.

### Étape 3 — Fournir les identifiants (variables d'environnement)

```bash
# macOS / Linux
export QA_DEFAULT_USER="mon.compte@exemple.com"
export QA_DEFAULT_PASSWORD="motdepasse"

# Windows PowerShell
$env:QA_DEFAULT_USER = "mon.compte@exemple.com"
$env:QA_DEFAULT_PASSWORD = "motdepasse"
```

Utilisez les mêmes noms que dans `qa.config.json`. Les secrets ne sont jamais écrits sur disque.

### Étape 4 — (Optionnel) Indiquer les zones à risque

Pour que la plateforme teste en priorité ce qui compte, ajoutez dans
`qa.config.json` la section `coverage_intelligence.business_risk` (note 0 à 10 par
domaine), par ex. `{ "checkout": 10, "login": 8, "profile": 2 }`. Si vous l'ignorez,
des valeurs par défaut s'appliquent. Détails : [COVERAGE-INTELLIGENCE.md](COVERAGE-INTELLIGENCE.md).

### Étape 5 — Lancer une campagne

Dans Claude Code, tapez :

```
/qa-campaign
```

L'orchestrateur `qa-analyst` enchaîne alors automatiquement, **domaine par domaine
et par ordre de risque** :

1. **Couverture** — repère les zones non testées et les priorise (`prioritize`).
2. **Découverte** — explore l'application et inventorie pages/éléments/API.
3. **Parcours** — déduit les scénarios (nominal, alternatif, erreur, limite).
4. **Automatisation** — génère les tests Playwright (POM + fixtures, TypeScript).
5. **Exécution** — lance les tests et classe chaque échec : **PRODUIT** (vrai bug),
   **SCRIPT** (test à réparer) ou **ENV** (environnement).
6. **Auto-réparation** — corrige les échecs SCRIPT (sélecteurs cassés…) et relance.

Vous n'avez rien à piloter : répondez seulement si l'agent demande une confirmation.

### Étape 6 — Lire les résultats

Chaque campagne écrit dans `.qa/runs/<date>-<NNN>/` :
- `report.json` — synthèse de la campagne ;
- `execution_report.json` — résultats détaillés ;
- `bugs_report.json` — bugs PRODUIT (à transmettre aux développeurs) ;
- `pipeline.log` — journal de l'orchestration.

Pour un rapport lisible : `npm run report` (HTML Playwright) ou demandez à l'agent
« génère le rapport de la dernière campagne » (skill `qa-report-generator`).

### Étape 7 — Au quotidien

- **Réparer des tests cassés** sans tout relancer : `/qa-heal`.
- **Voir uniquement les manques de couverture** : `/qa-coverage`.
- **Voir l'ordre de priorité calculé** (sans lancer de campagne) :
  `node kernel/dist/cli.js prioritize --top 5` — affiche chaque domaine, sa
  priorité (0-100) et la raison (`business_risk`, `recent_git_changes`, …).
- **Partir d'un besoin écrit** (brief → spécifications → user stories) : `/qa-sdd`.

### En cas de souci

| Symptôme | Cause probable / solution |
|---|---|
| `node: command not found` ou version < 22.5 | Installer/mettre à jour Node.js ≥ 22.5. |
| L'agent dit que le kernel est absent | Relancer l'étape 1 (`npm --prefix kernel run build`). |
| Connexion échoue | Vérifier `base_url`, `auth.steps` et les variables d'environnement (étape 3). |
| Aucun test généré | Vérifier que `coverage_gaps` n'est pas vide (l'app est peut-être déjà couverte). |
| Tests « flaky » | Ne jamais augmenter un timeout à l'aveugle — voir `.claude/rules/testing.md`. |

## Structure

```
.claude/
├── agents/        qa-analyst (orchestrateur) + agents 0–6
├── skills/        playwright-best-practices (pack TestDino curaté)
├── commands/      /qa-campaign, /qa-coverage, /qa-heal
├── rules/         code-style, testing, selectors
└── settings.json  permissions
.qa/               config projet, contrats qa-mesh, AgentDB (mémoire persistante)
tests/             specs par feature : tests/<feature>/<feature>.<flux>.spec.ts
pages/             Page Object Model (une classe par page)
fixtures/          pages.fixture.ts — source unique de { test, expect }
utils/             test-data.ts (credentials via env), api-client.ts, helpers.ts
examples/          exemples de plans de test
```

## Les agents

| Agent | Rôle |
|---|---|
| `qa-analyst` | Orchestration, validation des contrats, transmission sélective |
| `qa-coverage-gap-analyzer` (0) | Gaps de couverture, sélection du domaine, sessions |
| `qa-context-discovery` (1) | Exploration Playwright, catalogue compressé, sélecteurs |
| `qa-journey-mapper` (2) | Parcours NOM/ALT/ERR/LIMITE |
| `qa-test-designer` (3) | Gherkin + CSV Xray/Zephyr/TestRail — à la demande |
| `qa-automation-engineer` (4) | Scénarios → Playwright TS avec POM et fixtures |
| `qa-test-executor` (5) | Exécution, classification PRODUIT/SCRIPT/ENV |
| `qa-healing-coordinator` (6) | Auto-réparation bornée, sélecteurs alternatifs |

## Commandes

```bash
npm test               # suite complète
npm run test:chromium  # un navigateur
npm run typecheck      # validation TS
npm run report         # rapport HTML
```

Documentation complète : [ARCHITECTURE.md](ARCHITECTURE.md) ·
Instructions agents : [CLAUDE.md](CLAUDE.md)
