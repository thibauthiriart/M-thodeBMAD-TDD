Lancer le pipeline TDD+BMAD pour une User Story ou un Bug.

Tu es un orchestrateur de pipeline. Tu ne developpes pas, tu ne testes pas toi-meme. Tu coordonnes les agents specialises en lancant le script pipeline.py.

## Prerequisites

La US ou le bug doit exister dans `US/{story-id}/{story-id}.md` avant de lancer le pipeline.

## Deux modes

### Mode Feature (par defaut)
Pipeline : Facade → Phoenix TDD → Dev Parallel → Tests → Sherlock loop

### Mode Bug (`--bug`)
Pipeline : Investigation → Phoenix Regression → Dev Parallel → Tests → Sherlock loop

## Phases

### Mode Feature

#### Phase 1 : Front Minimal (Facade)
Construire la coquille interactive : composants, routing, data-testid.
ZERO logique metier, ZERO appels API.
Genere les criteres negatifs (ce qui ne doit PAS se produire).

#### Phase 2 : Phoenix TDD
Ecrire les tests E2E AVANT l'implementation (positifs ET negatifs).
Les tests vont echouer : c'est le but du TDD.

### Mode Bug

#### Phase 1 : Investigation
Analyse read-only du bug : tracer le flux de donnees complet, localiser la cause racine.
Produit un rapport `investigation-report.md`.

#### Phase 2 : Phoenix Regression
Ecrire des tests de regression qui reproduisent le bug (doivent echouer avant le fix).

### Phases communes (3-5)

#### Phase 3 : Dev Front + Dev Back (parallele)
Implementer la feature/fix pour faire passer les tests.

#### Phase 4 : Tests E2E
Executer les tests. Si tout passe -> DONE.

#### Phase 5 : Boucle Sherlock (si echecs)
Sherlock diagnostique progressivement (niveaux 1->4).
- Niveau 1 : Diagnostic rapide
- Niveau 2 : Analyse semantique + anti-faux-positif
- Niveau 3 : Audit cross-feature
- Niveau 4 : Escalade humaine
Le rapport cumulatif est dans `US/{story-id}/sherlock-report.md`.

## Commande

```bash
cd .claude/scripts

# Feature mode
python pipeline.py $ARGUMENTS

# Bug mode
python pipeline.py <bug-id> --bug

# Voir l'etat
python pipeline.py --status

# Reprendre une US/bug interrompue (mode auto-detecte)
python pipeline.py --resume <story-id>

# Batch
python pipeline.py --batch all
python pipeline.py --batch 2
python pipeline.py --batch 2-1,2-3 --skip-done
python pipeline.py --batch BUG-001,BUG-002 --bug
```

## Structure des fichiers

```
US/
  {story-id}/
    {story-id}.md              # La User Story ou Bug definition
    investigation-report.md    # Rapport d'investigation (bug mode)
    sherlock-report.md         # Rapport Sherlock cumulatif
```

## Format Bug

Pour lancer le mode bug, creer `US/<bug-id>/<bug-id>.md` avec :

```markdown
# Bug <bug-id>: [Description]

## Type
bug

## Description du bug
[Ce qui se passe et pourquoi c'est un probleme]

## Etapes de reproduction
1. [Etape 1]
2. [Etape 2]

## Comportement attendu
[Ce qui devrait se passer]

## Comportement reel
[Ce qui se passe actuellement]

## Zone suspectee (optionnel)
[Fichier ou module suspect]
```

$ARGUMENTS
