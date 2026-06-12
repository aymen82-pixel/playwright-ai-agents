---
description: Lance une campagne QA autonome complète (Agent 0 → Agent 6)
---

Lance l'agent `qa-analyst` pour une campagne QA complète sur le domaine : $ARGUMENTS

Si aucun domaine n'est fourni, l'Agent 0 (qa-coverage-gap-analyzer) sélectionne
automatiquement le domaine prioritaire d'après les gaps de couverture.

Séquence attendue :
1. Vérifier `.qa/qa.config.json` (s'il manque : initialiser et STOP pour validation).
2. Phase 1 — couverture (Agent 0) → `gaps_coverage.json`.
3. Phase 2 — découverte (Agent 1) puis parcours (Agent 2).
4. Phase 4 — automatisation (Agent 4) avec sélecteurs AgentDB.
5. Phase 5 — exécution (Agent 5), classification PRODUIT/SCRIPT/ENV.
6. Phase 6 — healing (Agent 6) si échecs SCRIPT, max 1 passe.
7. Clôture : rapport + mise à jour coverage-memory.

La phase 3 (Gherkin/CSV — Agent 3) n'est lancée QUE si je le demande explicitement.
