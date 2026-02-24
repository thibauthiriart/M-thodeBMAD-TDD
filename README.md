# BMAD Starter Kit

Kit portable pour integrer la methode **BMAD v6** (Business Method Agile-AI Driven Development) dans n'importe quel projet avec **Claude Code**.

BMAD orchestre tout le cycle de vie d'un projet via des **agents specialises** et des **slash commands** :

```
Product Brief → PRD → Architecture → Epics/Stories → Sprint → Dev → Review → QA → Retro
```

## Installation

### 1. Copier dans votre projet

```bash
cp -r bmad-starter-kit/* /chemin/vers/votre/projet/
cp -r bmad-starter-kit/.claude /chemin/vers/votre/projet/
```

### 2. Lancer le setup

```bash
cd /chemin/vers/votre/projet
./setup.sh
```

Le script configure automatiquement `CLAUDE.md`, `config.py`, `settings.json` et le venv Python.

### 3. Personnaliser

| Fichier | Quoi personnaliser |
|---------|-------------------|
| `CLAUDE.md` | Description du projet, regles specifiques |
| `.claude/scripts/agents.py` | `ENVIRONMENT_RULES`, `PROJECT_RULES`, `PROJECT_CONVENTIONS` |
| `.claude/validate-bash.sh` | Regles de validation des commandes bash |

Les 3 constantes dans `agents.py` sont injectees dans les prompts de **tous** les agents. C'est le seul endroit ou decrire votre stack.

---

## Pipelines

Le starter kit propose deux modes d'orchestration automatique.

### Pipeline TDD+BMAD (feature)

```bash
python .claude/scripts/pipeline.py <story-id>
```

```
┌──────────────────────┐
│  Phase 1 : Facade    │ Coquille UI + data-testid (ZERO logique metier)
│  (Front Minimal)     │ Genere les criteres negatifs (ce qui ne doit PAS arriver)
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Phase 2 : Phoenix   │ Ecrire les tests E2E AVANT le code (TDD)
│  (TDD)               │ Tests positifs + tests negatifs (effets de bord)
└──────────┬───────────┘
           │
┌──────────▼──────────────────────┐
│  Phase 3 : Dev Parallele       │ Dev Front + Dev Back en simultanee
│  (Front + Back)                │ Implementation pour faire passer les tests
└──────────┬──────────────────────┘
           │
┌──────────▼───────────┐
│  Phase 4 : Tests     │ Execution Playwright
└──────────┬───────────┘
           │
      PASS ─── DONE
           │
      FAIL ─── Sherlock (niveaux 1→4) → Fix → Re-test → ...
```

### Pipeline Bug

```bash
python .claude/scripts/pipeline.py <bug-id> --bug
```

```
┌──────────────────────┐
│  Phase 1 :           │ Analyse read-only du code
│  Investigation       │ Trace le flux complet, localise la cause racine
│                      │ Produit investigation-report.md
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│  Phase 2 : Phoenix   │ Tests de regression qui reproduisent le bug
│  (Regression)        │ Doivent echouer avant le fix (TDD)
└──────────┬───────────┘
           │
           ▼
     (memes phases 3-5 que le mode feature)
```

### Sprint classique

```bash
python .claude/scripts/dev_sprint.py <story-id>
```

Cycle simple : Dev → Code Review → QA → Fix loop (si echec, boucle).

### Commandes pipeline

```bash
cd .claude/scripts

# Feature
python pipeline.py 1-1                          # Une story
python pipeline.py --batch all                   # Toutes les stories
python pipeline.py --batch 2                     # Epic 2 entier
python pipeline.py --batch 2-1,2-3 --skip-done   # Stories specifiques

# Bug
python pipeline.py BUG-001 --bug                 # Un bug
python pipeline.py --batch BUG-001,BUG-002 --bug  # Plusieurs bugs

# Gestion
python pipeline.py --status                      # Etat de toutes les stories
python pipeline.py --resume 1-1                  # Reprendre (mode auto-detecte)
```

---

## Les 15 agents

### Agents de planning

| Agent | Nom | Role | Utilise par |
|-------|-----|------|-------------|
| **analyst** | Mary | Recherche marche, domaine, technique. Produit le product brief initial. | `/product-brief` |
| **pm** | John | Product Manager. Cree les PRD, decoupe en epics/stories, valide les requirements. 5 workflows : PRD lifecycle. | `/create-prd`, `/create-epics-and-stories` |
| **architect** | Winston | Decisions techniques, scalabilite, choix de stack, diagrammes d'architecture. Verifie que le design est implementable. | `/create-architecture` |
| **sm** | Bob | Scrum Master. Planification de sprint, preparation des stories, retrospectives, correction de cap mid-sprint. | `/sprint-planning`, `/create-story`, `/correct-course`, `/retrospective` |

### Agents de developpement

| Agent | Nom | Role | Utilise par |
|-------|-----|------|-------------|
| **dev** | Amelia | Senior Developer. Implemente les stories en respectant strictement l'ordre des taches. Ecrit les tests pour chaque tache. | `/dev-story`, `dev_sprint.py` |
| **quick-flow-solo-dev** | Barry | Variante rapide du dev pour petits changements et prototypage. Moins de ceremonies. | `/quick-spec` |

### Agents de qualite

| Agent | Nom | Role | Utilise par |
|-------|-----|------|-------------|
| **reviewer** | Alex | Code review adversariale. Classifie les problemes en CRITICAL/MAJOR/MINOR. Verdict PASS ou FAIL. Read-only. | `/code-review`, `dev_sprint.py` |
| **qa** | Quinn | Genere et lance les tests. Couvre happy path + cas limites. Rapport avec verdict. | `/qa-automate`, `dev_sprint.py` |
| **tea** | Murat | Architecte de tests enterprise. Strategie de tests avancee, quality gates, CI/CD. | Consultation directe |
| **pattern-reviewer** | Sage | Detecte les patterns recurrents (positifs et negatifs) dans le projet. Memoire entre les sessions. | `/pattern-review` |

### Agents pipeline TDD+BMAD

Ces agents sont appeles automatiquement par `pipeline.py`. Ils ne s'utilisent pas directement.

| Agent | Role | Phase | Mode |
|-------|------|-------|------|
| **front-minimal** (Facade) | Construit la coquille UI interactive. ZERO logique metier, ZERO appels API. Ajoute les `data-testid` sur tous les elements. Genere les **criteres negatifs** (ce qui ne doit PAS arriver comme effet de bord). | Phase 1 | Feature |
| **phoenix-tdd** | Ecrit les tests E2E **avant** l'implementation. Tests positifs (AC de la story) + tests negatifs (`describe("Ne doit PAS — effets de bord")`). Se base sur les `data-testid` du front minimal. | Phase 2 | Feature |
| **bug-investigator** | Explore le codebase en **read-only**. Trace le flux de donnees complet (UI → API → Service → DB). Localise la cause racine avec fichier:ligne. Produit `investigation-report.md`. | Phase 1 | Bug |
| **phoenix-regression** | Ecrit des tests de regression qui **reproduisent le bug** (TDD : doivent echouer avant le fix). Ajoute des tests adjacents pour les cas limites. | Phase 2 | Bug |
| **dev-front** | Implemente la logique frontend pour faire passer les tests E2E. Services API, stores, composants. Ne modifie pas les tests. | Phase 3 | Feature + Bug |
| **dev-back** | Implemente le backend pour faire passer les tests E2E. Routes, controllers, services, migrations. Ne modifie pas les tests. | Phase 3 | Feature + Bug |
| **sherlock** | Diagnostic progressif des echecs de tests. 4 niveaux d'analyse de plus en plus profonds. Rapport cumulatif. Read-only. | Phase 5 | Feature + Bug |

**Detail des niveaux Sherlock :**

| Niveau | Type d'analyse | Ce qu'il fait |
|--------|----------------|---------------|
| **L1** | Diagnostic rapide | Lit les erreurs, identifie les causes evidentes, corrections ciblees fichier:ligne |
| **L2** | Analyse semantique | Verifie que les valeurs en DB sont correctes pour le domaine metier. Trace les valeurs jusqu'a leur point de consommation. Regle anti-faux-positif. |
| **L3** | Audit cross-feature | Identifie toutes les vues/pages qui consomment les memes donnees. Verifie les hypotheses implicites du code. Propose une refonte si necessaire. |
| **L4** | Escalade humaine | Rapport complet de tout ce qui a ete tente. Liste des hypotheses testees et eliminees. Recommandation pour l'humain. |

### Agents UX

| Agent | Nom | Role | Utilise par |
|-------|-----|------|-------------|
| **ux-designer** | Sally | Audit et review de composants UI existants. Detecte la dette de design. Propositions en 3 plans (minimal/radical/ideal). | `/ux-review` |

Les skills UX (`/ux-creative`, `/ux-production`) chargent des personas UX specialisees :
- **/ux-creative** : Onboarding, gamification, micro-interactions, design emotionnel
- **/ux-production** : Tables de donnees, formulaires, accessibilite WCAG, design systems
- **/ux-review** : Audit de design, coherence composants, polish visuel

### Agent documentation

| Agent | Nom | Role | Utilise par |
|-------|-----|------|-------------|
| **tech-writer** | Paige | Documentation technique. CommonMark strict, diagrammes Mermaid, validation de docs, standards de style. Sidecar avec les regles de documentation. | Consultation directe |

Workflows disponibles : `[DP]` Document Project, `[WD]` Write Document, `[US]` Update Standards, `[MG]` Mermaid Generate, `[VD]` Validate Doc, `[EC]` Explain Concept.

---

## Les 22 slash commands

### Planning (du projet)

| Commande | Description |
|----------|-------------|
| `/product-brief` | Creer un product brief (vision, scope, marche cible) |
| `/create-prd` | Creer un PRD detaille (requirements fonctionnels et non-fonctionnels) |
| `/create-architecture` | Concevoir l'architecture technique (diagrammes, choix techno, ADR) |
| `/create-epics-and-stories` | Decouper le PRD en epics et stories |

### Sprint

| Commande | Description |
|----------|-------------|
| `/sprint-planning` | Planifier un sprint : selectionner les stories, generer `sprint-status.yaml` |
| `/create-story <id>` | Detailler une story avec taches, sous-taches, AC, criteres negatifs |
| `/sprint-status` | Vue d'ensemble du sprint : avancement, risques, prochaine story |
| `/correct-course` | Gerer un changement mid-sprint (re-prioriser, ajuster le scope) |
| `/retrospective` | Bilan post-epic : ce qui a marche, a ameliorer, actions |

### Developpement

| Commande | Description |
|----------|-------------|
| `/dev-story <id>` | Implementer une story (agent dev Amelia) |
| `/dev-sprint <id>` | Orchestration complete : dev → review → QA → fix loop |
| `/quick-spec` | Tech spec rapide pour petits changements ou bugs simples |
| `/pipeline <id>` | Pipeline TDD+BMAD complet (feature ou bug) |
| `/orchestrate-sprint` | Orchestrer un sprint entier automatiquement |

### Qualite

| Commande | Description |
|----------|-------------|
| `/code-review` | Review adversariale du code (CRITICAL/MAJOR/MINOR) |
| `/qa-automate` | Generer et lancer les tests automatises |
| `/pattern-review` | Detecter les patterns recurrents (positifs et negatifs) |

### UX

| Commande | Description |
|----------|-------------|
| `/ux-creative` | Design innovant : onboarding, gamification, micro-interactions |
| `/ux-production` | Composants production-ready : tables, formulaires, accessibilite |
| `/ux-review` | Audit de design : dette visuelle, coherence, propositions 3 plans |

### Utilitaires

| Commande | Description |
|----------|-------------|
| `/party-mode` | Discussion multi-agents (brainstorming collaboratif) |
| `/bmad-help` | Aide sur la methode BMAD et les commandes disponibles |

---

## Logging

Le pipeline produit des logs detailles dans `.claude/scripts/logs/`.

### Logs en temps reel (agent_runner)

Chaque action de chaque agent est loggee au fur et a mesure :

```
[facade]  READ   frontend/src/components/UserList.vue
[facade]  WRITE  frontend/src/components/UserForm.vue
[facade]  EDIT   frontend/src/router/index.ts  (const routes = [...)
[facade]  BASH   cd frontend && npm run build
[facade]  GREP   'data-testid' in frontend/src/
[facade]  Termine — 23 appels d'outils, 8 tours
```

### Resumes de phase (pipeline)

Apres chaque phase, un resume structure :

```
[FRONT MINIMAL] Termine en 3m 42s
[FRONT MINIMAL] Fichiers touches (7) :
  → frontend/src/components/UserForm.vue
  → frontend/src/router/index.ts
[FRONT MINIMAL] data-testid crees (12) :
  → user-form, save-btn, name-input
[FRONT MINIMAL] Criteres negatifs generes : 3
```

### Detail des tests en echec

```
[TESTS] Resultats : 8 passed, 3 failed, 0 skipped / 11 total
[TESTS] Tests en echec (3) :
  ✘ should display user form with all fields
  ✘ should save user and redirect
  ✘ should not show data from other tenant
[TESTS] Erreurs detectees (2) :
  → Error: expect(locator).toBeVisible()
  → AssertionError: expected 0 to equal 1
```

### Diagnostic Sherlock

```
[SHERLOCK L1] Bugs identifies (2) :
  → BUG-001: UserForm ne bind pas le champ email
  → BUG-002: Route API manque le middleware auth
[SHERLOCK L1] Corrections suggerees :
  → frontend/src/components/UserForm.vue:42 — ajouter v-model="form.email"
```

---

## Structure des fichiers

```
bmad-starter-kit/
├── setup.sh                     # Configuration interactif
├── CLAUDE.md.template           # Template instructions projet
├── README.md
│
├── .claude/
│   ├── agents/                  # 15 agents
│   │   ├── dev.agent.yaml
│   │   ├── qa.agent.yaml
│   │   ├── reviewer.agent.yaml
│   │   ├── architect.agent.yaml
│   │   ├── analyst.agent.yaml
│   │   ├── pm.agent.yaml
│   │   ├── sm.agent.yaml
│   │   ├── tea.agent.yaml
│   │   ├── front-minimal.agent.yaml
│   │   ├── e2e-qa.agent.yaml
│   │   ├── e2e-diagnostic.agent.yaml
│   │   ├── pattern-reviewer.agent.yaml
│   │   ├── quick-flow-solo-dev.agent.yaml
│   │   ├── ux-designer.agent.yaml
│   │   └── tech-writer/
│   │       ├── tech-writer.agent.yaml
│   │       └── tech-writer-sidecar/
│   │           └── documentation-standards.md
│   │
│   ├── commands/                # 22 slash commands
│   ├── skills/                  # 3 skills UX
│   │   ├── ux-creative/
│   │   ├── ux-designer/
│   │   └── ux-production/
│   │
│   ├── scripts/                 # Orchestration Python
│   │   ├── config.py            # Chemins, limites, modeles
│   │   ├── agents.py            # 12 agents SDK (prompts + tools)
│   │   ├── agent_runner.py      # Runner SDK + logging temps reel
│   │   ├── pipeline.py          # Pipeline TDD+BMAD (feature + bug)
│   │   ├── dev_sprint.py        # Sprint classique (dev → review → QA)
│   │   └── requirements.txt     # claude-agent-sdk, pyyaml
│   │
│   ├── settings.json
│   └── validate-bash.sh
│
├── _bmad/                       # Framework BMAD v6
│   ├── core/
│   └── bmm/
│       ├── workflows/
│       ├── teams/
│       └── data/
│
├── _bmad-output/                # Artefacts generes (vide au depart)
└── US/                          # User Stories et Bugs (vide au depart)
```

---

## Format des User Stories et Bugs

### User Story

Creer `US/<story-id>/<story-id>.md` :

```markdown
# Story <story-id>: Titre de la story

## Description
Description fonctionnelle.

## Criteres d'acceptation
- [ ] AC-1 : L'utilisateur peut...
- [ ] AC-2 : Le systeme affiche...

## Taches
- [ ] 1. Creer le composant UI
- [ ] 2. Implementer l'API
- [ ] 3. Ecrire les tests
```

### Bug

Creer `US/<bug-id>/<bug-id>.md` et lancer avec `--bug` :

```markdown
# Bug <bug-id>: Titre du bug

## Type
bug

## Description du bug
Ce qui se passe et pourquoi c'est un probleme.

## Etapes de reproduction
1. Aller sur la page X
2. Cliquer sur Y
3. Observer Z

## Comportement attendu
Ce qui devrait se passer.

## Comportement reel
Ce qui se passe actuellement.

## Zone suspectee (optionnel)
Fichier ou module suspect.
```

---

## Pre-requis

- **Claude Code** (CLI Anthropic)
- **Python 3.11+** (pour les scripts d'orchestration)
- **claude-agent-sdk** (installe par `setup.sh`)
- **Node.js** (si tests E2E Playwright)

## FAQ

**Puis-je utiliser BMAD sans les scripts Python ?**
Oui. Les slash commands (`/dev-story`, `/code-review`, etc.) fonctionnent sans les scripts. Les scripts ajoutent l'orchestration automatique (pipeline TDD, boucles fix, batch).

**Comment ajouter un agent personnalise ?**
Creez `.claude/agents/mon-agent.agent.yaml` en suivant le format YAML des agents existants, puis creez `.claude/commands/mon-command.md` qui le reference.

**Comment fonctionne le bug mode ?**
Le pipeline bug inverse les phases 1-2 : au lieu de construire une UI et ecrire des tests TDD, il investigue la cause racine puis ecrit des tests de regression qui reproduisent le bug. Les phases 3-5 (dev, tests, sherlock) sont identiques.

**Les workflows BMAD sont-ils modifiables ?**
Oui. Les fichiers dans `_bmad/bmm/workflows/` sont des Markdown/YAML editables.
