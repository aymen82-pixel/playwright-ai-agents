---
description: Analyse de couverture seule — rapport des gaps sans lancer de campagne
---

Lance uniquement l'agent `qa-coverage-gap-analyzer` (Agent 0) : $ARGUMENTS

Produire le rapport de gaps (`gaps_coverage.json`) et un résumé lisible :
routes non couvertes par priorité (C/E/M/F), scores par domaine
(coverage-memory), et domaine recommandé pour la prochaine campagne.

NE PAS enchaîner sur les agents suivants — analyse seule.
