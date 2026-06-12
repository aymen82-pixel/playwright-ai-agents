---
name: qa-test-data-factory
description: Génère des données de test réalistes, uniques et idempotentes pour les specs Playwright — jeux nominaux, edge cases, personas par rôle. Use when generating test data, creating fixtures with dynamic data, designing boundary/edge case inputs, or when a spec needs unique identifiers, emails, or form payloads. Utilisé par l'Agent 4 (qa-automation-engineer) et l'Agent 3 (qa-test-designer).
---

# Test Data Factory

## Règles absolues

1. **Unicité** : toute donnée créée en base est suffixée `TestE2E-{Date.now()}`
   via `uniqueId()` de `utils/test-data.ts`. Jamais de valeur fixe qui
   provoquerait une collision entre runs ou entre workers parallèles.
2. **Credentials** : JAMAIS en dur. Toujours `utils/test-data.ts` +
   variables d'environnement (`QA_DEFAULT_USER`, `QA_DEFAULT_PASSWORD`, rôles
   définis dans `.qa/qa.config.json`).
3. **Idempotence** : chaque test crée SES données et ne dépend jamais de
   données laissées par un autre test.
4. **Vérification par API** : création vérifiée via `waitForCreation()` de
   `utils/api-client.ts` (`POST → 201`), pas par scraping de tableau.

## Générateurs standards

```typescript
// À ajouter dans utils/test-data.ts si absent (ne pas modifier les exports existants)
export const uniqueId = (prefix = 'TestE2E') => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
export const uniqueEmail = (domain = 'test.example') => `${uniqueId('qa').toLowerCase()}@${domain}`;
export const uniquePhone = () => `06${String(Date.now()).slice(-8)}`;
```

## Checklist edge cases par type de champ

| Type | Cas à couvrir (priorité E/M) |
|---|---|
| Texte libre | vide · 1 caractère · longueur max · longueur max+1 · espaces seuls · accents/émojis · `<script>` (XSS basique) · `' OR 1=1` (injection basique) |
| Email | sans `@` · sans domaine · double `@` · majuscules · alias `+tag` |
| Nombre | 0 · négatif · min−1 · max+1 · décimales si entier attendu · non numérique |
| Date | aujourd'hui · passé · futur · 29 février · format invalide · timezone |
| Fichier | type interdit · taille 0 · taille max+1 · nom avec espaces/accents |
| Sélection | aucune option · option désactivée · valeurs multiples si simple attendu |

## Personas

Un persona = un rôle de `.qa/qa.config.json#roles` + un jeu de données
cohérent. Ne jamais inventer de rôle : si le rôle n'existe pas dans la config,
marquer le scénario `INS` (insuffisant) et le signaler dans le livrable.

## Anti-patterns (bloqués par le hook qa-guard)

- Mot de passe ou token littéral dans un spec ou un POM
- Donnée partagée entre deux tests (couplage d'ordre)
- `faker` ou dépendance externe non présente dans package.json — utiliser les
  générateurs ci-dessus, zéro dépendance
