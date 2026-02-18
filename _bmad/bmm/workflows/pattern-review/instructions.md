# Pattern Review — Instructions

## Objectif

Analyser les artefacts du projet pour detecter les patterns recurrents (positifs et negatifs) et proposer des actions d'amelioration.

## Sources a analyser

Lire et analyser les fichiers suivants dans l'ordre :

### 1. Historique des patterns (si existant)

- `_bmad/_memory/pattern-reviewer/patterns-history.md` — Patterns precedemment detectes

### 2. Code Reviews

- `_bmad-output/code-review.md` — Derniere code review
- `_bmad-output/code-review-consolidated.md` — Code review consolidee (si existant)
- Chercher d'autres fichiers `*code-review*` dans `_bmad-output/`

### 3. Retrospectives

- Chercher `*retro*` dans `_bmad-output/` — Bilans post-epic

### 4. Sprint Status

- `_bmad-output/sprint-status.yaml` — Etat des stories (chercher des patterns dans les statuts)

### 5. Stories terminees

- Scanner `_bmad-output/stories/` — Lire les stories `done` pour identifier des patterns dans :
  - Les notes techniques
  - Les problemes rencontres
  - Les solutions appliquees

### 6. Code source (si pertinent)

- Scanner les tests qui echouent ou ont ete modifies recemment
- Identifier les fichiers modifies le plus souvent (hotspots)

## Analyse a produire

### A. Patterns negatifs (a corriger)

Pour chaque pattern negatif detecte :

| Champ | Description |
|-------|-------------|
| **Pattern** | Description concise du pattern |
| **Frequence** | Combien de fois observe, sur quelle periode |
| **Preuves** | Fichiers et lignes exacts |
| **Impact** | Consequence sur la qualite, la velocite ou la dette technique |
| **Action recommandee** | Correction concrete et mesurable |
| **Priorite** | Haute / Moyenne / Basse |

### B. Patterns positifs (a renforcer)

Pour chaque pattern positif :

| Champ | Description |
|-------|-------------|
| **Pattern** | Description concise |
| **Frequence** | Combien de fois observe |
| **Preuves** | Exemples concrets |
| **Valeur** | Ce que ca apporte au projet |
| **Recommandation** | Comment le systematiser ou l'etendre |

### C. Tendances

- Evolution par rapport a la derniere analyse (si historique existe)
- Patterns emergents (observes 1-2 fois, a surveiller)
- Patterns resolus depuis la derniere review

### D. Score de sante

Attribuer un score de 1 a 5 sur chaque dimension :

| Dimension | Score | Justification |
|-----------|-------|---------------|
| Architecture | /5 | |
| Tests | /5 | |
| Conventions | /5 | |
| Dette technique | /5 | |
| Velocite | /5 | |

## Output

### 1. Afficher le rapport structure a l'utilisateur

### 2. Sauvegarder dans la memoire persistante

Mettre a jour le fichier `_bmad/_memory/pattern-reviewer/patterns-history.md` avec :

```markdown
# Pattern Review — {date du jour}

## Patterns negatifs
[liste]

## Patterns positifs
[liste]

## Tendances
[observations]

## Score de sante
[tableau]

## Actions recommandees
[liste priorisee]
```

Si le fichier existe deja, ajouter la nouvelle analyse en TETE du fichier (les plus recentes en premier). Conserver l'historique complet.

### 3. Proposer des actions

Terminer par une liste d'actions priorisees avec la question :
"Voulez-vous que je cree des stories pour les actions recommandees ?"
