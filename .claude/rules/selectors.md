# Règles — Sélecteurs

Priorité stricte (dans cet ordre) :

1. Sélecteur `validated: true` depuis AgentDB `.qa/agentdb/browser-selectors.json`
2. `getByRole(role, { name })` — vérifier le role ARIA réel (tab ≠ button ≠ link)
3. `getByLabel` / `getByPlaceholder`
4. `getByText` (contenu non interactif uniquement)
5. `getByTestId`
6. CSS en dernier recours — documenter pourquoi en commentaire

Compléments :

- Onglets de navigation → TOUJOURS `getByRole('tab')`.
- Texte dynamique → regex (`{ name: /pattern/i }`), jamais `.nth()` sur listes dynamiques.
- Ambiguïté (strict mode violation) → scoper dans un parent
  (`getByRole('dialog').getByRole('button')`), `exact: true`, ou `.filter()`.
- Tout nouveau sélecteur validé en exécution réelle DOIT être persisté dans
  AgentDB avec un `selector_fallback` d'une stratégie différente.
- Sélecteur introuvable et aucun candidat AgentDB → STOP et marquer le
  scénario `selector_unresolved` ; ne jamais inventer.
