# Coverage Intelligence — design (qa-mesh/2.0, étape 9)

> Statut : **IMPLÉMENTÉ (14 juin 2026).** `qa-mesh prioritize`/`score`/`ci
> put-metric` ; moteur pur `kernel/src/coverage/`, tables `ci_*`. Capacité de
> priorisation par le risque. Décision structurante (§10) : **module du kernel,
> PAS un Agent 7.**

## 0. Problème

Aujourd'hui toutes les fonctionnalités sont traitées à parité : un écran « Profil »
reçoit autant d'attention qu'un tunnel de paiement. La plateforme sait découvrir,
générer, exécuter, réparer — mais ne sait pas **calculer la valeur d'un test** ni
**où investir le budget navigateur/LLM**. Coverage Intelligence attribue un score
de priorité déterministe à chaque domaine / page / parcours / scénario.

## 1. Décision d'architecture (§10) — kernel, pas d'Agent 7

Le scoring est une **somme pondérée de facteurs mesurables** (config, SQL, git,
graphe de parcours) : aucun ne requiert de jugement en langage naturel. Le mettre
dans un LLM (Agent 7) réintroduirait les 3 maux que la V2 a éliminés : travail
mécanique payé en tokens, non-déterminisme (un score halluciné est pire
qu'absent), contexte orchestrateur qui gonfle. Un score doit être **reproductible
et auditable**.

→ **Kernel calcule, `qa-analyst` arbitre (override politique), agents-feuilles
consomment.** Le seul jugement LLM légitime est l'override ponctuel (« gèle
checkout, il est en refonte »), qui appartient à l'agent de politique existant.

## 2. Garde-fous obligatoires (sinon la capacité crée des angles morts)

1. **Plafond de péremption** : toute zone, même 100 % verte depuis N campagnes,
   est re-testée de force au-delà de `max_staleness`. La stabilité réduit la
   *fréquence*, jamais à zéro. (Anti boucle de rétroaction toxique.)
2. **Plancher de risque métier** : un checkout ne tombe jamais sous `floor`
   (ex. 40/100) même 100 % vert. `business_risk` est un plancher, pas qu'un additif.
3. **Cold start** : campagne 1 = aucun historique. Le score dégrade proprement
   sur `business_risk` (config) + `git_impact` + `criticality` ; les 2 facteurs
   historiques montent en puissance avec les runs.
4. **Mapping fichier→domaine** : le facteur Git exige de relier
   `src/checkout/PaymentForm.tsx` → domaine `checkout` (config `path_domain_map`
   + heuristique `pages/<domain>/`, `tests/<domain>/`).

## 3. Architecture

Module kernel `coverage-intelligence` exposé par `qa-mesh score` / `prioritize`,
alimenté par les tables AgentDB v2 existantes + 3 nouvelles. Aucun nouvel agent,
aucun nouveau serveur MCP.

```
 git log ──▶ git-impact ┐
 qa.config ▶ business    ├─▶ scoring engine ─▶ {priority, factors, reason[]}
 AgentDB:   criticality  │   (somme pondérée, normalisée, plancher+plafond)
   journal ─ failure      │                 │
   coverage stability    ┘                 ▼  ci_score_history (SQLite, audit)
                          qa-mesh prioritize --json  (injecté via filter/pack)
   Agent 0 / 1 / 2 / 4 / 5 / 6  ◀── consomment ;  qa-analyst ◀── arbitre/override
```

## 4. Modèle de données SQLite (extension AgentDB v2)

```sql
CREATE TABLE ci_metrics (          -- criticité par entité
  entity_type TEXT, entity_key TEXT, domain TEXT,
  dependents INTEGER, users_impacted INTEGER, depth INTEGER, frequency REAL,
  updated_at TEXT, PRIMARY KEY (entity_type, entity_key));

CREATE TABLE ci_git_activity (     -- activité git mappée au domaine
  path TEXT PRIMARY KEY, domain TEXT, last_changed_at TEXT,
  commits_window INTEGER, recency_score REAL);

CREATE TABLE ci_score_history (    -- audit + sortie {priority, reason[]} + base stabilité
  run_id TEXT, entity_type TEXT, entity_key TEXT,
  priority INTEGER, factors TEXT, reason TEXT, computed_at TEXT);
```

`business_risk` reste en **config** (`qa.config.json#coverage_intelligence`).
`failure` et `stability` se dérivent de `coverage` + `journal` (déjà livrés) — pas
de duplication.

## 5. Algorithme de scoring (facteurs normalisés 0..1)

| Facteur | Source | Calcul | Coût |
|---|---|---|---|
| `business` | config | `business_risk[domain] / 10` | O(1) |
| `criticality` | journeys (A2) | min-max de `α·dependents + β·depth + γ·freq + δ·users` | O(parcours×étapes) |
| `failure` | coverage+journal | EWMA de `(1 − pass_rate)` sur K runs (récence pondérée) | O(K) |
| `git` | `git log --since` | `Σ commits·e^(−âge/τ)` des fichiers du domaine, normalisé | 1 git/campagne |
| `stability` | ci_score_history | `min(maxDiscount, streak_vert / S)` — soustractif, borné | O(historique) |

## 6. Formule finale

```
raw = w_b·business + w_c·criticality + w_f·failure + w_g·git − w_s·stability
priority = clamp(floor_business[domain], 100, round(100·raw))
# défaut : w_b=.30 w_c=.20 w_f=.20 w_g=.20 w_s=.10 (configurables)
# floor : checkout/payment=40, login=30, reste=0
# anti-angle-mort : si jours_depuis_dernier_run > max_staleness → priority = max(priority, 70)
```

Sortie :
```json
{ "domain": "checkout", "priority": 92,
  "factors": {"business":1.0,"criticality":0.7,"failure":0.4,"git":0.8,"stability":0.0},
  "reason": ["business_risk","recent_git_changes","low_pass_rate"] }
```

## 7. Flux kernel → agents

Le kernel calcule, le `qa-analyst` injecte la priorité (via `filter`/`pack`) :

- **Agent 0** : `qa-mesh prioritize --top N` → plan de campagne ordonné (remplace « premier gap C »).
- **Agent 1** : budget d'exploration (`max_pages`, snapshots/page) ∝ priorité.
- **Agent 2** : profondeur de parcours (nb d'ALT/ERR/LIMITE) ∝ priorité.
- **Agent 4** : validation MCP différentielle *risk-aware* (rejoue live même si `validated:true` sur zone à risque).
- **Agent 5** : ordonnancement des exécutions par priorité.
- **Agent 6** : réparations des zones prioritaires d'abord.

## 8. Impact coûts & couverture

- **Coût : net négatif.** Scoring ~0 token (kernel). Réalloue le budget des zones
  stables/faibles vers les zones à valeur ; le plafond de péremption évite les
  angles morts. Surcoût : 1 `git log` + quelques requêtes SQL/campagne.
- **Couverture : pondérée par le risque** — plus profonde sur les flux critiques,
  plus légère sur le stable/faible, sans angle mort permanent (plancher + péremption).

## 9. Plan de migration (étape 9, par tranches autonomes)

1. Schéma `ci_*` + `qa-mesh score --domain` sur facteurs déjà dispo (business + failure).
2. `git-impact` (mapping path→domain + `git log`).
3. `criticality` depuis les parcours Agent 2.
4. `stability` + plancher + `max_staleness` + `qa-mesh prioritize` (vue agrégée + `reason[]`).
5. Câblage agents **0 → 5 → 6 d'abord** (ROI max), puis 1/2/4.

## 10. Exemple de campagne

```
$ qa-mesh prioritize --top 3 --json
[ {"domain":"checkout","priority":92,"reason":["business_risk","recent_git_changes","low_pass_rate"]},
  {"domain":"login",   "priority":71,"reason":["business_risk","recent_git_changes"]},
  {"domain":"profile", "priority":18,"reason":["stable_25_campaigns","low_business_risk"]} ]
```
→ A0 explore checkout d'abord ; A1 5 pages×2 snapshots sur checkout vs 1 sur profile ;
A2 6 parcours checkout / 2 profile ; A4 rejoue checkout en live ; A5 lance checkout
en premier ; A6 répare checkout d'abord. Profile sauté ce run, re-forcé au jour `max_staleness`.

## Verdict

Bonne évolution, alignée avec « kernel déterministe + agents-feuilles ». Implémentée
en kernel, elle augmente la valeur par token au lieu de la diluer. À planifier en
**étape 9**, après les étapes 5-8 du plan §9. **Pas d'Agent 7.**
