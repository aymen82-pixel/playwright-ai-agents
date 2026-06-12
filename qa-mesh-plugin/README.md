# qa-mesh — Plugin Claude Code

Plateforme QA autonome multi-agents Playwright, packagée pour être installée
sur **n'importe quel projet d'automatisation** sans copier de fichiers.

## Contenu

| Composant | Détail |
|---|---|
| `agents/` | `qa-analyst` (orchestrateur) + agents 0–6 + spécialistes parallèles (`qa-a11y-auditor`, `qa-compliance-checker`, `qa-perf-tester`) + chaîne SDD amont (`qa-spec-writer`, `qa-product-owner`) |
| `commands/` | `/qa-campaign`, `/qa-coverage`, `/qa-heal`, `/qa-sdd` |
| `skills/` | `playwright-best-practices`, `qa-test-data-factory`, `qa-strategy-docs`, `qa-report-generator`, `qa-sdd-docs` |
| `hooks/` | `qa-guard.js` (PreToolUse : bloque `waitForTimeout`, `networkidle`, `test.only`, URL/credentials en dur) · `qa-typecheck.js` (PostToolUse : `npm run typecheck` après toute écriture `.ts`) |
| `.mcp.json` | serveur MCP `playwright-test` (`npx playwright run-test-mcp-server`) |

## Installation sur un nouveau projet

```bash
# 1. Ajouter la marketplace (ce repo) puis installer le plugin
/plugin marketplace add aymen82-pixel/playwright-ai-agents
/plugin install qa-mesh@qa-mesh-marketplace

# 2. Dans le projet cible : initialiser la config locale
mkdir .qa
# copier .qa/qa.config.example.json → .qa/qa.config.json et renseigner base_url, rôles
# copier .qa/contracts/ (schémas JSON inter-agents)

# 3. Exporter les credentials
$env:QA_DEFAULT_USER = "..."; $env:QA_DEFAULT_PASSWORD = "..."

# 4. Lancer
/qa-campaign
```

## Ce qui reste LOCAL au projet (jamais dans le plugin)

- `.qa/qa.config.json` — seules données spécifiques au projet testé
- `.qa/contracts/` — schémas de contrats (versionnés avec le projet)
- `.qa/agentdb/` — mémoire persistante (sélecteurs, sessions, couverture)
- `.qa/runs/` — livrables de campagne
- `tests/`, `pages/`, `fixtures/`, `utils/` — le code généré
- `playwright.config.ts`, `tsconfig.json`

Le plugin est 100 % agnostique au métier : aucune URL, aucun credential,
aucune règle projet. Conforme au principe de neutralité de `ARCHITECTURE.md`.

## Synchronisation depuis le repo template

La source canonique de développement est `.claude/` du repo template.
Pour resynchroniser le plugin après une évolution :

```powershell
robocopy .claude\agents qa-mesh-plugin\agents /MIR
robocopy .claude\commands qa-mesh-plugin\commands /MIR
robocopy .claude\skills qa-mesh-plugin\skills /MIR
robocopy .claude\hooks qa-mesh-plugin\hooks qa-guard.js qa-typecheck.js
```

Puis incrémenter `version` dans `.claude-plugin/plugin.json`.
