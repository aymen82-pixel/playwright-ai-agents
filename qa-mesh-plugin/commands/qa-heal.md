---
description: Répare les tests Playwright cassés (Agent 6 — Self-Healing)
---

Lance l'agent `qa-healing-coordinator` (Agent 6) sur : $ARGUMENTS

Si aucun fichier n'est précisé : exécuter d'abord la suite (`npx playwright test`),
classifier les échecs, puis ne traiter que les échecs SCRIPT.

Rappels de garde-fous : maximum 3 tentatives par test, jamais le même correctif
deux fois, jamais d'affaiblissement d'assertion ; si l'app est en cause,
requalifier en bug PRODUIT et marquer `test.fixme()` documenté.
Mettre à jour `.qa/agentdb/browser-selectors.json` pour chaque sélecteur corrigé.
