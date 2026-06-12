---
name: qa-strategy-docs
description: Produit les livrables QA documentaires — stratégie de recette, cas de test manuels Gherkin/BDD, exports CSV Xray/Zephyr/TestRail, matrice de traçabilité. Use when writing a test strategy document, generating Gherkin scenarios or feature files, exporting test cases to a test management tool (Xray, Zephyr, TestRail), or building a traceability matrix. Utilisé par l'Agent 3 (qa-test-designer).
---

# Livrables QA documentaires

Trois livrables imbriqués : stratégie de recette → cas Gherkin → exports.
Identifier lequel est demandé avant de commencer.

## 1. Stratégie de recette — structure standard

```markdown
# Stratégie de Recette — [Projet] v[X.Y]
## 1. Contexte & objectifs        (application, type de campagne, version)
## 2. Périmètre                   (in-scope / out-of-scope)
## 3. Approche                    (niveaux, types, priorités C > E > M > F)
## 4. Environnements & données    (tableau env / URL / données / responsable)
## 5. Critères d'entrée / sortie  (DoR : build stable, données, accès ;
                                   DoD : 100% critiques exécutés, ≥95% succès, 0 bloquant)
## 6. Gestion des anomalies       (outil, sévérités, workflow)
## 7. Livrables & planning        (plan, cas, rapport + échéances)
## 8. Risques & mitigations       (tableau probabilité / impact / mitigation — TOUJOURS inclus)
```

Adapter le détail : livraison critique → exhaustif ; sprint → allégé.
Source des données projet : `.qa/qa.config.json` + `gaps_coverage.json` (Agent 0).

## 2. Cas de test Gherkin — règles

- **Given** : état du système · **When** : UNE action par step · **Then** :
  résultat observable (jamais « le système fonctionne »).
- Chaque scénario indépendant, aucun ordre d'exécution requis.
- Couverture minimale par fonctionnalité : nominal (C) + alternatif (E) +
  limites (E) + erreur (M) — aligné sur les types `NOM|ALT|ERR|LIMITE` des
  contrats `.qa/contracts/`.
- Tags = priorité + type : `@critique @smoke`, `@erreur @negative`.
- ID stable `TC-NNN` tracé vers le parcours source (`J-NNN`) — le même ID se
  retrouve dans `// @scenario` du spec Playwright (traçabilité bout en bout).

```gherkin
# ID: TC-001 · Priorité: C · Source: J-003
Feature: [Fonctionnalité]
  @critique @smoke
  Scenario: Cas nominal — [contexte]
    Given [état initial]
    When [action unique]
    Then [résultat observable]
```

## 3. Exports CSV

**Xray (Jira)** — colonnes : `Issue ID;Test Type;Test Summary;Test Priority;Action;Data;Expected Result;Labels`
**Zephyr Scale** — colonnes : `Name,Status,Priority,Component,Labels,Description,Steps`
(steps séparés par `|`, expected préfixé `Expected:`)
**TestRail** — colonnes : `Title,Section,Priority,Type,Steps,Expected Result`

Échapper les `"` par doublement, encodage UTF-8 BOM pour Excel/Jira.

## 4. Matrice de traçabilité

| Gap (Agent 0) | Parcours (Agent 2) | Cas manuel | Spec auto | Statut |
|---|---|---|---|---|
| GAP-001 | J-003 | TC-001 | `tests/login/login.nominal.spec.ts` | OK |

Toute ligne sans spec auto = candidate au backlog d'automatisation ; toute
ligne `INS` = donnée ou rôle manquant à remonter dans le rapport.
