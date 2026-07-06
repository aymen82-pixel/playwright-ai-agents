# Objectif du loop `demo-regression`

Module ciblé : tests/ (suite de démo du repo qa-mesh — tests/seed.spec.ts,
tests/simple-input-form.spec.ts)

Critère de succès mesurable : Suite verte, 0 échec SCRIPT/ENV (un KO PRODUIT
est un vrai bug applicatif, pas un échec de loop — il ne bloque jamais la
décision).

> **Ceci est le loop de démo/gabarit** livré avec l'étape v3 — il démontre le
> cycle complet (init → run → verify → decide → retry/escalade) sur la suite
> de tests EXISTANTE de ce repo. Pour un loop réel sur un autre projet
> (ex. zupdeco-presentiel), copier ce dossier, adapter `loop.yaml`
> (`target`, `whitelist`, `allowed_agents`) et ce fichier — le kernel est déjà
> prêt, aucune modification de code n'est nécessaire.

## Contexte pour l'agent

En cas de `retry`, les motifs de rejet de la dernière itération sont dans
`PROGRESS.md` (dernière entrée du run en cours). Ne relire ni les rapports
Playwright complets, ni l'historique des campagnes précédentes.
