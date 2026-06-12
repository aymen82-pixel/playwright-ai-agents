---
name: qa-report-generator
description: Transforme les livrables JSON d'une campagne QA (report.json, execution_report.json, healing_report.json) en rapport Markdown lisible par un humain — synthèse exécutive, bugs PRODUIT, métriques, tendance de couverture. Use when generating a campaign report, summarizing test execution results, writing an executive QA summary, or when a run in .qa/runs/ needs to be presented to stakeholders. Utilisé par le qa-analyst en clôture de campagne.
---

# Générateur de rapport de campagne

## Sources (toutes dans `.qa/runs/{run_id}/`)

- `report.json` — synthèse orchestrateur, statuts par phase
- `execution_report.json` — résultats par test, classification `PRODUIT|SCRIPT|ENV`
- `bugs_report.json` — anomalies produit
- `healing_report.json` — réparations effectuées (si Agent 6 a tourné)
- `.qa/agentdb/coverage-memory.json` — tendance de couverture inter-campagnes

## Template de sortie (`.qa/runs/{run_id}/RAPPORT.md`)

```markdown
# Rapport de campagne QA — {run_id} — {date}

## Synthèse exécutive
- **Verdict** : ✅ OK / ⚠️ À surveiller / ❌ Bloquant   (1 phrase de justification)
- **Tests** : {total} exécutés · {pass} OK · {fail} KO · {pct}% de succès
- **Bugs produit** : {n} (dont {bloquants} bloquants) — voir §2
- **Auto-réparations** : {healed}/{attempted} réussies
- **Couverture du domaine** : {score} ({delta} vs campagne précédente)

## 1. Résultats par feature
| Feature | Tests | OK | KO | Classification des échecs |
|---|---|---|---|---|

## 2. Bugs PRODUIT (action humaine requise)
Pour chaque bug : ID, scénario source (TC-NNN/J-NNN), étape qui échoue,
comportement attendu vs observé, sévérité, lien trace Playwright.

## 3. Échecs SCRIPT et healing
Tableau : test → cause (sélecteur/attente/donnée) → réparation → re-run.
Les `selector_unresolved` listés à part : backlog humain.

## 4. Échecs ENV
Regroupés, sans action de réparation (environnement, pas le code de test).

## 5. Métriques pipeline
Durée par phase, retries consommés, tokens si disponibles (`metrics` des
enveloppes dans pipeline.log).

## 6. Reste à faire
Gaps non couverts (Agent 0), scénarios INS (données/rôles manquants),
recommandations pour la campagne suivante.
```

## Règles de rédaction

- **Verdict d'abord** : un décideur doit comprendre l'état en 10 secondes.
- Aucun jargon agent (« Agent 5 », « SCRIPT ») dans la synthèse exécutive —
  réserver les codes aux sections techniques.
- Chaque bug PRODUIT tracé bout en bout : gap → parcours → scénario → spec →
  trace. Jamais de bug sans étape de reproduction.
- Chiffres issus EXCLUSIVEMENT des JSON sources — ne jamais estimer ou
  inventer une métrique manquante (écrire « non mesuré »).
- Si > 30 % d'échecs ENV ou > 50 % d'échecs persistants : le verdict est
  ❌ avec recommandation d'arrêt (seuils de résilience d'ARCHITECTURE.md §10).
