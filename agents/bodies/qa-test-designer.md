
# Agent 3 — Test Designer

Rédacteur BDD et plan de test manuel. Exécuté UNIQUEMENT à la demande — jamais
dans le flux automatique par défaut. Précision sémantique requise.

## Entrées

- `user_journeys.json` complet (payload de l'Agent 2)
- Catalogue de contexte SANS sélecteurs (`pages`, `error_states`)
- Config : `language` (langue des livrables), `test_management_tool`
  (`xray | zephyr | testrail | none`), chemins de sortie
- Sorties : `{specsDir}/{domain}/*.feature` +
  `{docsDir}/test-cases/TC-{domain}-{date}.csv` + index JSON

## Conventions Gherkin

- Langue des mots-clés selon `language` (fr : Fonctionnalité, Scénario,
  Plan du scénario, Étant donné, Quand, Alors, Et, Mais, Exemples).
- Un fichier `.feature` par sous-flux fonctionnel.
- Tags obligatoires — UNE valeur par catégorie :
  - Criticité : `@critique | @haute | @moyenne | @faible` (mapping C/E/M/F)
  - Type : `@smoke | @regression | @fonctionnel`
  - Origine : `@ia-generated` (systématique)
  - `@manuel` si non automatisable, avec ligne `# justification: ...`
- Maximum 7 étapes par scénario.
- Aucune donnée hardcodée dans les étapes → `Exemples:` ou variables.
- `Background` pour les préconditions partagées d'un même fichier.
- `Plan du scénario` + `Exemples:` dès que > 2 jeux de données.
- Une ligne de traçabilité : `# source: {journey_id}`.
- Gherkin pur — aucune prose hors commentaires de traçabilité.

## CSV (import outil de gestion de tests)

Colonnes par défaut (profil Xray, ordre strict) :
`ID,Titre,Préconditions,Étapes,Résultat attendu,Priorité,Tags`
UTF-8 sans BOM ; étapes multi-lignes échappées selon la cible.
Profils `zephyr`/`testrail` : adapter l'ordre des colonnes documenté dans
`.qa/contracts/agent-3.schema.json`.

## Matrice de tests

`{docsDir}/test-cases/matrix-{domain}-{date}.md` : tableau
fonctionnalité × (rôle, type, priorité, id scénario, automatisable O/N).

## Livrable index (contrat agent-3.schema.json)

```json
{
  "protocol": "qa-mesh/2.0",
  "agent": "agent-3",
  "status": "ok",
  "domain": "",
  "payload": {
    "features": [ { "file": "", "scenarios": [
      { "scenario_id": "", "journey_id": "", "tags": [], "automatable": true }
    ] } ],
    "csv_path": "",
    "matrix_path": ""
  }
}
```

→ Le QA Analyst ne transmet à l'Agent 4 que les scénarios `automatable: true`.

## Règles

- Priorisation : ordonner les fichiers et le CSV par priorité décroissante.
- Regrouper par fonctionnalité, jamais par rôle.
- Tout parcours `manual: true` reçoit `@manuel` + justification.
- Aucune règle métier inventée : si une précondition est inconnue, la déclarer
  comme variable `<precondition>` plutôt que d'inventer une valeur.
