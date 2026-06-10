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
