---
name: qa-sdd-docs
description: Templates et règles de rédaction pour la chaîne SDD amont — spécification fonctionnelle détaillée (SFD avec exigences F-NNN et règles de gestion RG-NNN.N), user stories INVEST avec critères d'acceptation Given/When/Then. Use when writing a functional specification, drafting user stories, formulating acceptance criteria, or converting a brief into structured requirements. Utilisé par qa-spec-writer et qa-product-owner.
---

# Livrables SDD — templates et règles

## 1. Template SFD (`sfd.md`)

```markdown
# Spécification fonctionnelle — [Module] v[X.Y]
> Source : [fichiers d'entrée] · Date : [date] · Statut : brouillon

## 1. Objet et périmètre        (quoi, pour qui, hors périmètre)
## 2. Acteurs                   (rôle, droits, volumétrie estimée)
## 3. Glossaire                 (uniquement si ambiguïté dans le matériau source)
## 4. Exigences fonctionnelles

### F-001 — [Nom] (priorité C)
**Description** : [comportement observable attendu]
**Acteurs** : [qui]
**Règles de gestion** :
- RG-001.1 : [règle précise, mesurable]
- RG-001.2 : …
**Cas d'erreur attendus** :
- [entrée invalide → message/comportement attendu]

## 5. Questions ouvertes
| ID | Question | Impact si non résolue | Bloquant |
|---|---|---|---|
| Q-001 | … | … | oui/non |
```

## 2. Règles de formulation d'une exigence

- **Observable et testable** : « le système affiche X », « le délai n'excède
  pas N ms » — jamais « le système doit être ergonomique/performant/robuste ».
- **Atomique** : un « et » qui relie deux comportements = deux exigences.
- **Sourcée** : tout ce qui n'est pas dans le matériau d'entrée est une
  question ouverte, pas une invention.
- **Fonctionnelle pure** : aucune décision de stack, d'archi ou d'UI.

## 3. Template user story

```
US-001 (← F-001, priorité C, statut draft)
En tant que [acteur de la SFD], je veux [action], afin de [bénéfice].

Critères d'acceptation :
- US-001.AC-1 (← RG-001.1)
  Étant donné [état initial]
  Quand [action unique]
  Alors [résultat observable]
```

Check INVEST avant livraison : Indépendante (pas d'ordre requis entre US),
Négociable, de Valeur (le `afin de` est réel), Estimable, Suffisamment petite
(> 7 critères = découper), Testable (chaque critère devient un scénario
Gherkin sans réécriture).

## 4. Pont vers la conception de tests (Agent 3)

La correspondance est mécanique — c'est le but du format :

| SDD | Conception | Automatisation |
|---|---|---|
| `F-NNN` | Feature Gherkin | `tests/<feature>/` |
| `US-NNN.AC-1` | `Scenario TC-NNN` | `// @scenario TC-NNN` |
| critère nominal | tag `@critique @smoke` | parcours `NOM` |
| critère d'erreur | tag `@erreur @negative` | parcours `ERR` |

## 5. Checkpoint humain (non négociable)

Entre le PO et la conception de tests, un humain valide le backlog
(`BACKLOG.md`) : il passe les US de `draft` à `approved` ou `rejected`.
Aucun agent ne pose `approved`. Les US `blocked` (question ouverte bloquante)
restent hors flux jusqu'à résolution de la `Q-NNN` référencée.
