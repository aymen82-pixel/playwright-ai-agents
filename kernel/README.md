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
node kernel/dist/cli.js db prune --stale 30d [--dry-run]
node kernel/dist/cli.js db export --out .qa/agentdb/agentdb.export.json
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
| `src/commands/db.ts` | Dispatch des sous-commandes `db` |
| `src/db/agentdb.ts` | `AgentDb` — wrapper SQLite (`node:sqlite`, WAL) |
| `src/db/migrate.ts` | Migration JSON→SQLite + parseur de durée `--stale` |
| `src/db/distance.ts` | Distance de Levenshtein (similarité healing) |
| `src/paths.ts` | Résolution portable de `.qa` |

## Feuille de route (plan §9)

- [x] **Étape 1** — `validate` (Ajv) + `journal`, branchés sur le QA Analyst.
- [x] **Étape 2** — AgentDB SQLite (`db init/migrate/put/get/pack/similar/prune/export`,
      sessions + couverture) ; agents 0/1/4/5/6 + analyst recâblés sur le CLI.
- [ ] Étape 3 — `routing.yaml` déclaratif + `filter`.
- [ ] Étape 4 — manifeste + `compile --target claude|opencode|codex|copilot|gemini`.
- [ ] Étapes 5-8 — validation MCP différentielle, sharding, contrats `qa-mesh/2.0`, nettoyage.
