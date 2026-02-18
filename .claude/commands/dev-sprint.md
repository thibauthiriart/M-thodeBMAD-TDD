Orchestrer le cycle complet d'une story : dev -> review -> tests -> fix loop.

Tu es un orchestrateur. Tu ne developpes pas, tu ne reviews pas, tu ne testes pas toi-meme. Tu coordonnes les agents specialises en lancant les commandes appropriees.

## Workflow

### Etape 1 : Implementation

Lancer `/dev-story $ARGUMENTS`

Attendre que l'implementation soit terminee (story marquee done dans `_bmad-output/sprint-status.yaml`).

### Etape 2 : Code Review

Lancer `/code-review` sur les fichiers modifies par l'etape 1.

Sauvegarder les resultats dans `_bmad-output/reviews/{story-id}-review.md`.

- Si AUCUN probleme critical ou major -> passer a l'etape 3
- Si problemes critical ou major -> passer a l'etape 4 (Fix Loop)

### Etape 3 : Tests automatises

Lancer `/qa-automate` sur la story implementee.

Sauvegarder les resultats dans `_bmad-output/reviews/{story-id}-qa.md`.

- Si tous les tests passent -> la story est TERMINEE, passer a l'etape 5
- Si des tests echouent -> passer a l'etape 4 (Fix Loop)

### Etape 4 : Fix Loop (si necessaire)

Lancer `/dev-story` avec comme contexte les problemes identifies en etape 2 et/ou 3.
Puis relancer l'etape 2 (re-review).

Maximum 3 iterations. Au-dela, presenter un rapport et demander a l'utilisateur comment proceder.

### Etape 5 : Resume final

Afficher :

```
STORY {id} — TERMINEE
---------------------
Implementation : OK
Code Review    : {resultats}
Tests          : {resultats}
Fix iterations : {n}
Fichiers modifies : {liste}

Resultats :
  - _bmad-output/reviews/{story-id}-review.md
  - _bmad-output/reviews/{story-id}-qa.md
```

Mettre a jour `_bmad-output/sprint-status.yaml` : story -> done

$ARGUMENTS
