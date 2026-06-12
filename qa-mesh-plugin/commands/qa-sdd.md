---
description: Chaîne SDD amont — brief → SFD → user stories → checkpoint humain
---

Lance la chaîne SDD amont sur : $ARGUMENTS

1. **Agent SPEC** : lancer `qa-spec-writer` avec le matériau fourni en
   argument (fichiers, dossier `input/` selon `qa.config.json#sdd.input_dir`,
   ou contenu collé). Livrables : `sfd.md` + `spec_index.json`.
2. Valider `spec_index.json` contre `.qa/contracts/agent-spec.schema.json`.
3. **Agent PO** : lancer `qa-product-owner` avec UNIQUEMENT le payload de
   `spec_index.json`. Livrables : `user_stories.json` + `BACKLOG.md`.
4. Valider contre `.qa/contracts/agent-po.schema.json`.
5. **STOP — checkpoint humain obligatoire** : présenter `BACKLOG.md`
   (US, priorités, critères, questions ouvertes bloquantes) et demander la
   validation. Ne JAMAIS enchaîner sur la conception ou l'automatisation :
   la suite (`/qa-campaign` ou Agent 3) n'est lancée que lorsque l'humain a
   passé les US à `approved`.

Rappels : aucune exigence inventée (tout manque = question ouverte Q-NNN) ;
traçabilité F-NNN → US-NNN.AC-N préservée — elle deviendra TC-NNN puis
`// @scenario` dans les specs.
