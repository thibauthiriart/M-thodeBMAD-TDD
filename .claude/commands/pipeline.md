Lancer le pipeline TDD+BMAD pour une User Story.

Tu es un orchestrateur de pipeline. Tu ne développes pas, tu ne testes pas toi-même. Tu coordonnes les agents spécialisés en lançant le script pipeline.py.

## Prérequis

La US doit exister dans `US/{story-id}/{story-id}.md` avant de lancer le pipeline.

## Pipeline

Le pipeline suit la méthode décrite dans `Méthode.md` :

### Phase 1 : Front Minimal (Facade)
Construire la coquille interactive : composants Vue, routing, HTML/Tailwind, data-testid.
ZERO logique métier, ZERO appels API.

### Phase 2 : Phoenix TDD
Écrire les tests Playwright AVANT l'implémentation.
Se base sur la US + le front minimal + les data-testid.
Les tests vont échouer — c'est le but du TDD.

### Phase 3 : Dev Front + Dev Back (parallèle)
Implémenter la feature complète pour faire passer les tests.
- Front : services API, stores Pinia, logique
- Back : controllers, services, migrations, routes API

### Phase 4 : Tests Playwright
Exécuter les tests. Si tout passe → DONE.

### Phase 5 : Boucle Sherlock (si échecs)
Sherlock diagnostique progressivement (niveaux 1→4).
Le rapport cumulatif est dans `US/{story-id}/sherlock-report.md`.
Les devs reçoivent le rapport et corrigent, puis re-test.
Niveau 4 = escalade humaine.

## Commande

```bash
cd /home/thibaut/Bureau/testApp/.claude/scripts

# Lancer le pipeline pour une US
python pipeline.py $ARGUMENTS

# Voir l'état
python pipeline.py --status

# Reprendre une US interrompue
python pipeline.py --resume <story-id>
```

## Structure des fichiers

```
US/
  {story-id}/
    {story-id}.md           # La User Story
    sherlock-report.md      # Rapport Sherlock cumulatif
```

## État persistant

L'état du pipeline est sauvegardé dans `_bmad-output/pipeline-state.yaml`.
En cas de coupure, utiliser `--resume` pour reprendre.

$ARGUMENTS
