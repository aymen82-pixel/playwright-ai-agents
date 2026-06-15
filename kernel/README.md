# qa-mesh kernel — runtime déterministe (qa-mesh/2.0)

CLI TypeScript léger qui sort le travail **mécanique** des agents LLM : validation
des contrats, journalisation, et — étapes suivantes — filtrage/routage, résolution
de sélecteurs, AgentDB SQLite, compilation multi-runtimes.

> **Principe** : ce que le kernel fait, aucun LLM ne le refait. 0 token,
> 0 non-déterminisme sur les tâches d'infrastructure.

## Pré-requis

- Node ≥ 22.5 (utilise `node:sqlite` et le runner `node:test` intégrés).
- Seules dépendances : `ajv` + `ajv-formats` (validation JSON Schema draft-07).

## Build & test

```bash
npm --prefix kernel ci          # installe ajv / ajv-formats
npm --prefix kernel run build   # compile -> kernel/dist/
npm --prefix kernel test        # compile les tests -> dist-test/ et lance node:test
npm --prefix kernel run typecheck
```

Le binaire produit est `kernel/dist/cli.js`, invoqué par le QA Analyst :
`node kernel/dist/cli.js <commande>`.

## Commandes (étape 1)

### `validate` — conformité d'un livrable

```bash
node kernel/dist/cli.js validate <fichier|-> [--agent <id>] [--json]
```

Valide un livrable contre l'enveloppe `qa-mesh` **et** le contrat de payload de
l'agent (`.qa/contracts/*.schema.json`). `-` lit le livrable sur stdin. L'agent
est déduit du champ `agent` de l'enveloppe ou forcé via `--agent`.

- Exit `0` : conforme. Exit `1` : non conforme (erreurs listées).
- `--json` : sortie machine `{ valid, agent, errors[{layer,path,message}] }`.

### `manifest` / `compile` — source unique multi-runtimes

Les définitions d'agents vivent dans **une seule source** :
`agents/manifest.yaml` (métadonnées) + `agents/bodies/<name>.md` (corps prose
verbatim). `compile` régénère les définitions pour chaque runtime — fin du drift
des 5 copies maintenues à la main.

```bash
# Migration : .claude/agents/*.md -> agents/manifest.yaml + agents/bodies/
node kernel/dist/cli.js manifest build

# Compilation vers un runtime
node kernel/dist/cli.js compile --target claude            # écrit .claude/agents/*.md + .mcp.json
node kernel/dist/cli.js compile --target claude --check    # non-régression byte-identique (exit 1 si diff)
node kernel/dist/cli.js compile --target opencode          # .opencode/agent/*.md + opencode.json
node kernel/dist/cli.js compile --target gemini --dry-run  # liste les fichiers sans écrire
```

- Cibles : `claude` · `opencode` · `codex` · `copilot` · `gemini`.
- **Garantie clé** : `compile --target claude` reproduit **byte-identique** les
  `.claude/agents/*.md` (frontmatter ordre fixe + corps verbatim, eol LF/CRLF
  préservé par fichier). Prouvé par test de non-régression sur les 13 agents.
- Chaque cible émet aussi la déclaration du serveur MCP `playwright-test`
  (`.mcp.json`, `opencode.json`, `.codex/config.toml`, `.vscode/mcp.json`,
  `.gemini/settings.json`) — un seul serveur, fin du drift (§7).
- `codex`/`copilot`/`gemini` n'ayant pas de sous-agents fichiers dédiés, leurs
  définitions sont compilées en un bundle d'instructions unique (AGENTS.md /
  copilot-instructions.md / GEMINI.md).

### `filter` — transmission sélective déclarative

Projette le payload d'un livrable selon l'arête `from->to` de `.qa/routing.yaml`
(source unique, remplace la table prose d'ARCHITECTURE.md §2). Sort l'extrait
JSON destiné à l'injection dans le prompt de l'agent cible.

```bash
node kernel/dist/cli.js filter --from 1 --to 2 .qa/runs/<run>/context_catalog.json
# ou via stdin, et avec les identifiants complets :
cat deliverable.json | node kernel/dist/cli.js filter --from agent-5 --to agent-6 -
```

- `--from`/`--to` acceptent `1` ou `agent-1`.
- Grammaire des champs dans `routing.yaml` (cf. `src/routing/project.ts`) :
  `domain` · `session.{a,b}` · `pages[].{url,title}` · `api_calls` ·
  `results[?failure.kind==SCRIPT].{id,spec}` (filtre + projection).
- Les **sélecteurs ne transitent jamais** par `filter` : ils viennent de `db pack`.
- Arête absente de `routing.yaml` → code de sortie `2` + liste des arêtes connues.

### `db` — AgentDB v2 (SQLite, WAL)

Mémoire persistante inter-campagnes. Fichier `.qa/agentdb/agentdb.sqlite`
(gitignoré). Accès EXCLUSIF via le kernel — les agents n'ouvrent jamais le
fichier directement : c'est ce qui rend la concurrence des spécialistes sûre.

```bash
node kernel/dist/cli.js db init                 # crée la base + schéma
node kernel/dist/cli.js db migrate              # importe les .qa/agentdb/*.json legacy
# put : flags (1 sélecteur) ou JSON objet/tableau sur stdin (batch)
echo '[{"domain":"auth","page":"/login","label":"email","selector_primary":"#email","validated":true}]' \
  | node kernel/dist/cli.js db put
node kernel/dist/cli.js db get --domain auth --validated-only --json
node kernel/dist/cli.js db pack --domain auth --for agent-4   # JSON groupé par page
node kernel/dist/cli.js db similar --domain auth --page /login --label emailFld --top 3
node kernel/dist/cli.js db pack --domain auth --for agent-4 --fresh 30d  # ajoute `trusted` par sélecteur
node kernel/dist/cli.js db prune --stale 30d [--dry-run]
node kernel/dist/cli.js db export --out .qa/agentdb/agentdb.export.json
# Validation MCP différentielle (étape 5) + dashboard (étape 6)
cat execution_report.json | node kernel/dist/cli.js db record-results --run <run_id> --domain auth
node kernel/dist/cli.js db passed-scenarios --domain auth --json   # scénarios verts campagne précédente
node kernel/dist/cli.js db journal --run <run_id> --json           # journal SQLite (le `journal` y écrit aussi)
node kernel/dist/cli.js db session-put --role admin --storage-state <p> --expires <iso>
node kernel/dist/cli.js db coverage-put --domain auth --score 0.85 --routes-hash <h>
```

- **Versioning append-only** : chaque `put` insère `version = max+1` pour la clé
  `(domain,page,label)`. `get`/`pack` ne renvoient que la version courante ;
  l'historique permet le rollback d'un healing raté.
- **Similarité (healing)** : `similar` classe les sélecteurs de la même page par
  distance d'édition (Levenshtein) sur le `label`.
- **Export/import JSON** : `db export` produit un dump versionnable en Git
  (le `.sqlite` lui-même est gitignoré). Format = namespaces v1
  (`browser-selectors`/`browser-sessions`/`coverage-memory`).

> ⚠️ Sous Git Bash (Windows), un flag `--page /login` peut être réécrit par la
> conversion de chemins MSYS. Préférer le **mode stdin JSON** pour `put`
> (c'est de toute façon le mode batch des agents), ou exporter `MSYS_NO_PATHCONV=1`.

### `journal` — événement d'orchestration

```bash
node kernel/dist/cli.js journal <run_id> --agent <id> \
  --status <ok|partial|error|retry|skipped> \
  [--deliverable <chemin>] [--anomaly <msg> ...] [--start <iso>] [--end <iso>] [--json]
```

Valide l'entrée (schéma `run-journal` de `.qa/agentdb/schema.json`) puis l'ajoute
en JSONL à `.qa/runs/<run_id>/pipeline.log`.

### `prioritize` / `score` / `ci` — Coverage Intelligence (étape 9)

Priorise les domaines par le risque (somme pondérée déterministe de 5 facteurs :
risque métier, criticité, taux d'échec, activité git, stabilité). Plancher métier
et plafond de péremption évitent les angles morts. Design : `COVERAGE-INTELLIGENCE.md`.

```bash
node kernel/dist/cli.js prioritize [--top <n>] [--since <30d>] [--record [--run <id>]] [--json]
node kernel/dist/cli.js score --domain <d> [--json]    # score détaillé d'un domaine
node kernel/dist/cli.js ci put-metric --domain <d> [--dependents --depth --users --frequency]
```

- `prioritize` calcule, ordonne (priorité décroissante) et explique (`reason[]`).
  Lance `git log` une fois (fenêtre `--since`) pour le facteur d'activité récente.
- Données sources : `business_risk`/`floors`/`weights` depuis
  `qa.config.json#coverage_intelligence` (défauts si absent) ; criticité depuis
  `ci put-metric` (Agent 2) ; échec/stabilité depuis `scenario_runs`
  (`db record-results`) ; activité depuis git.
- `--record` archive les scores dans `ci_score_history` (audit + base stabilité).
- Sortie JSON : `[{domain, priority: 0-100, factors{}, reason[]}]`.

## Résolution de `.qa`

`$QA_DIR` si défini, sinon recherche ascendante d'un dossier `.qa` depuis le cwd.
Le kernel est ainsi invocable depuis n'importe quel emplacement du projet.

## Architecture interne

| Fichier | Rôle |
|---|---|
| `src/cli.ts` | Parseur d'arguments minimal (zéro dépendance) + dispatch |
| `src/contracts.ts` | `ContractRegistry` — charge et compile tous les contrats avec Ajv |
| `src/commands/validate.ts` | Commande `validate` |
| `src/commands/journal.ts` | Commande `journal` |
| `src/commands/filter.ts` | Commande `filter` (transmission sélective) |
| `src/routing/project.ts` | Moteur de projection (parse + applique les chemins) |
| `src/routing/yaml.ts` | Parseur YAML minimal (`routing.yaml` + `manifest.yaml`) |
| `src/commands/manifest.ts` | Commande `manifest build` (migration vers la source unique) |
| `src/commands/compile.ts` | Commande `compile` (génération multi-runtimes + `--check`) |
| `src/manifest/manifest.ts` | Parse/recompile byte-identique + (dé)sérialisation manifeste |
| `src/manifest/targets.ts` | Émetteurs par runtime (agents + config MCP) |
| `src/commands/db.ts` | Dispatch des sous-commandes `db` |
| `src/db/agentdb.ts` | `AgentDb` — wrapper SQLite (`node:sqlite`, WAL) |
| `src/db/migrate.ts` | Migration JSON→SQLite + parseur de durée `--stale` |
| `src/db/distance.ts` | Distance de Levenshtein (similarité healing) |
| `src/commands/coverage.ts` | Commandes `prioritize`/`score`/`ci` + invocation git + config |
| `src/ci/score.ts` | Moteur de scoring pur (5 facteurs, formule, garde-fous) |
| `src/ci/git.ts` | Facteur git : mapping chemin→domaine + récence |
| `src/paths.ts` | Résolution portable de `.qa` |

## Feuille de route (plan §9)

- [x] **Étape 1** — `validate` (Ajv) + `journal`, branchés sur le QA Analyst.
- [x] **Étape 2** — AgentDB SQLite (`db init/migrate/put/get/pack/similar/prune/export`,
      sessions + couverture) ; agents 0/1/4/5/6 + analyst recâblés sur le CLI.
- [x] **Étape 3** — `.qa/routing.yaml` déclaratif + `qa-mesh filter` ; transmission
      sélective retirée du prompt qa-analyst (resp. #2 déléguée au kernel).
- [x] **Étape 4** — `agents/manifest.yaml` + `agents/bodies/` (source unique) ;
      `qa-mesh manifest build` + `compile --target claude|opencode|codex|copilot|gemini`.
      Byte-identique Claude prouvé (test de non-régression sur 13 agents).
- [x] **Étape 5** — validation MCP différentielle : `pack --fresh` annote `trusted`
      (validé+frais) ; `db record-results` + `db passed-scenarios` (mémoire d'exécution) ;
      Agent 4 n'écrit en direct que les étapes `trusted` d'un scénario déjà vert.
- [x] **Étape 6** — journal dual-write SQLite (`db journal --run`) pour le dashboard ;
      sharding Agent 5 par feature (`--workers`/`--shard`).
- [x] **Étape 7** — contrats `qa-mesh/2.0` : protocole 2.0 (1.0 accepté mais
      DÉPRÉCIÉ, `validate` émet un warning non bloquant) + champ `schema_version`.
- [x] **Étape 8** — doctrine source unique : priorité sélecteurs / interdits
      retirés des prompts (renvoi à `.claude/rules/`) ; `rules:` déclarées dans le
      manifeste et injectées dans les bundles non-Claude (codex/copilot/gemini).
- [x] **Étape 9** — Coverage Intelligence : `prioritize`/`score`/`ci put-metric`,
      5 facteurs (business/criticité/échec/git/stabilité), plancher métier +
      plafond de péremption. Tables `ci_*`. Voir COVERAGE-INTELLIGENCE.md.

**Plan §9 (étapes 1-9) : COMPLET.**
