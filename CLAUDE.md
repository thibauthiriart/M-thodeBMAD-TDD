# CLAUDE.md - testApp

Ce fichier fournit des instructions a Claude Code pour travailler sur ce projet.

## Projet

testApp est Mon app de test.

- **Backend**: Laravel 12 + PHP 8.4 + MySQL 8 + Redis
- **Frontend**: Vue 3 + TypeScript + Pinia + Tailwind CSS v4
- **Auth**: Laravel Passport v13 + Socialite (Google OAuth)
- **Tests**: Pest (backend) + Vitest (frontend) + Playwright (E2E)

## Structure du projet

```
testapp/
├── api/              # Backend Laravel 12
├── frontend/         # Frontend Vue 3 + TypeScript
├── docker-compose.yml
├── _bmad/            # Installation BMAD v6 (workflows, core)
├── _bmad-output/     # Documentation generee (architecture, stories, etc.)
└── .claude/          # Agents, commands, skills, scripts
    ├── agents/       # Agents YAML (dev, qa, architect, etc.)
    ├── commands/     # Slash commands BMAD
    ├── skills/       # Skills specialisees
    └── scripts/      # Orchestration Python (dev_sprint.py)
```

### Structure BMAD v6

```
_bmad/                    # Installation BMAD v6
├── core/                 # Core (bmad-master, brainstorming, party-mode)
└── bmm/                  # Business Methods Module
    ├── module.yaml       # Config BMM
    ├── teams/            # Definitions d'equipes
    ├── data/             # Templates de donnees
    └── workflows/        # Tous les workflows (24+)
```

## Suivi d'avancement (BMAD)

**Source de verite pour l'avancement des stories : `_bmad-output/sprint-status.yaml`**

Ce fichier YAML contient l'etat de toutes les stories par Epic. Les statuts possibles sont :
- `backlog` : Story non commencee
- `ready-for-dev` : Story specifiee, prete a developper
- `in-progress` : En cours de developpement
- `review` : Code termine, en revue
- `done` : Story terminee

### Commandes BMAD utiles

| Commande | Description |
|----------|-------------|
| `/bmad-help` | Aide sur la methode BMAD |
| `/sprint-planning` | Planifier un sprint, generer sprint-status.yaml |
| `/sprint-status` | Vue d'ensemble du sprint, risques, prochaine story |
| `/create-story` | Creer une story detaillee |
| `/dev-story` | Implementer une story |
| `/code-review` | Review du code implemente |
| `/qa-automate` | Generer des tests automatises |
| `/party-mode` | Discussion multi-agents |
| `/correct-course` | Gerer un changement mid-sprint |
| `/retrospective` | Retrospective post-epic |
| `/pattern-review` | Detecter les patterns recurrents (positifs/negatifs) |
| `/quick-spec` | Tech spec rapide pour petits changements |
| `/product-brief` | Creer un product brief |
| `/create-prd` | Creer un PRD |
| `/create-architecture` | Concevoir l'architecture technique |
| `/create-epics-and-stories` | Decouper en epics et stories |

## IMPORTANT: Environnement Docker (Laravel Sail)

**LE PHP LOCAL EST DIFFERENT DU PHP DANS DOCKER !**

Le projet utilise Laravel Sail pour l'environnement de developpement. Le PHP installe localement sur la machine hote est **DIFFERENT** du PHP dans le container Docker (PHP 8.4).

### REGLES STRICTES - INTERDICTIONS

```bash
# INTERDIT - Ne JAMAIS utiliser ces commandes !
docker exec ...           # INTERDIT !
docker-compose exec ...   # INTERDIT !
docker run ...            # INTERDIT !
php artisan ...           # INTERDIT ! (PHP local != PHP Docker)
composer ...              # INTERDIT ! (PHP local != PHP Docker)
```

### REGLE OBLIGATOIRE: Utiliser SAIL uniquement

**TOUTES les commandes PHP/Laravel/Composer DOIVENT passer par le wrapper `sail`.**

**Pour utiliser sail, il faut OBLIGATOIREMENT etre dans le repertoire `./api`**

```bash
# OBLIGATOIRE: D'abord aller dans le repertoire api/
cd /home/thibaut/Bureau/testApp/api

# Ensuite utiliser sail pour TOUTES les commandes
./vendor/bin/sail artisan test --parallel
./vendor/bin/sail artisan migrate
./vendor/bin/sail composer install
./vendor/bin/sail php artisan tinker
```

### Commandes courantes

| Action | Commande |
|--------|----------|
| Lancer les tests backend (Pest) | `cd api && ./vendor/bin/sail pest` |
| Lancer un fichier de test | `cd api && ./vendor/bin/sail pest tests/Feature/NomTest.php` |
| Lancer tests en parallele | `cd api && ./vendor/bin/sail pest --parallel` |
| Migrations | `cd api && ./vendor/bin/sail artisan migrate` |
| Seed database | `cd api && ./vendor/bin/sail artisan db:seed` |
| Composer install | `cd api && ./vendor/bin/sail composer install` |
| Artisan tinker | `cd api && ./vendor/bin/sail php artisan tinker` |
| Lancer les tests frontend | `cd frontend && npm run test` |

### Tests Backend (Pest)

**IMPORTANT**: Toujours utiliser `sail pest` pour les tests backend, jamais `./vendor/bin/pest` directement !

```bash
# CORRECT - Utiliser sail
cd /home/thibaut/Bureau/testApp/api
./vendor/bin/sail pest                                    # Tous les tests
./vendor/bin/sail pest tests/Feature/ImportStatusTest.php # Un fichier
./vendor/bin/sail pest --filter="retries failed"          # Par nom de test
./vendor/bin/sail pest --parallel                         # En parallele

# INCORRECT - NE PAS utiliser pest directement
./vendor/bin/pest ...  # INTERDIT ! (PHP local != PHP Docker)
```

### Demarrage des services

```bash
# Demarrer tous les containers (depuis api/)
cd api && ./vendor/bin/sail up -d

# Arreter les containers
cd api && ./vendor/bin/sail down
```

## Architecture Multi-tenant

Tous les modeles metier utilisent le trait `BelongsToEntreprise` pour le scope automatique par `entreprise_id`.

## Conventions de nommage

### Backend (Laravel)
- Controllers: `PascalCase` dans `app/Http/Controllers/Api/`
- Models: `PascalCase` dans `app/Models/`
- Form Requests: `PascalCase` dans `app/Http/Requests/`
- Resources: `PascalCase` dans `app/Http/Resources/`
- Services: `PascalCase` dans `app/Services/`
- Tests: `PascalCase` dans `tests/Feature/` et `tests/Unit/`

### Frontend (Vue 3)
- Composants: `PascalCase.vue` dans `src/components/`
- Stores Pinia: `use{Name}Store` dans `src/stores/`
- Services: `{name}Service.ts` dans `src/services/`
- Types: `{name}.ts` dans `src/types/`
- Tests: `*.spec.ts` a cote des fichiers ou dans `__tests__/`

## Methodologie de developpement

### REGLE ABSOLUE : Toute modification de code passe par BMAD

**INTERDIT** : Modifier du code directement sans passer par les agents BMAD.

**OBLIGATOIRE** : Utiliser `/bmad-help` pour voir les commandes disponibles, puis :
- `/quick-spec` pour les petits changements/bugs
- `/create-story` + `/dev-story` pour les nouvelles features
- `/code-review` apres chaque implementation

### Workflow standard

1. **Petite modification / Bug** : `/quick-spec` -> tech-spec -> implementation
2. **Nouvelle feature** : `/create-story` -> `/dev-story` -> `/code-review`
3. **Sprint complet** : `/sprint-planning` -> stories -> `/sprint-status` -> `/retrospective`

### Procedure de lancement d'un sprint

**Etape 1 : Verifier les stories avec `/create-story`**
```bash
# Pour chaque story du sprint, verifier qu'elle est conforme
/create-story <story-id>
```

**Etape 2 : Lancer le script d'orchestration**
```bash
cd /home/thibaut/Bureau/testApp/.claude/scripts

# Lister les stories disponibles
python dev_sprint.py --list

# Lancer une story specifique
python dev_sprint.py <story-id>

# Lancer toutes les stories ready-for-dev
python dev_sprint.py --all
```

**Le script `dev_sprint.py` orchestre automatiquement :**
1. **DEV** : Implementation de la story
2. **REVIEW** : Code review automatique
3. **QA** : Tests automatises
4. **FIX LOOP** : Si echec, relance le dev avec le contexte des erreurs
5. **Mise a jour** : sprint-status.yaml est mis a jour automatiquement

**Logs et rapports generes :**
- `_bmad-output/logs/sprint_*.log` — Logs complets
- `_bmad-output/reviews/<story-id>-review.md` — Rapport de code review
- `_bmad-output/reviews/<story-id>-qa.md` — Rapport QA

### Regles BMAD

- Utiliser les commandes BMAD pour tout developpement
- Se referer a `_bmad-output/sprint-status.yaml` comme source de verite pour l'etat des stories
- Mettre a jour `sprint-status.yaml` apres chaque story terminee
- Utiliser `/sprint-status` pour une vue rapide de l'avancement
- Utiliser `/correct-course` pour gerer les changements mid-sprint
- Utiliser `/retrospective` apres chaque epic terminee

## Regles critiques

1. **BMAD obligatoire**: TOUTE modification de code passe par les agents BMAD (`/bmad-help`)
2. **Validation**: TOUJOURS via Form Request Laravel, jamais dans le controller
3. **Reponses API**: TOUJOURS via API Resources
4. **Logique metier**: JAMAIS dans les controllers, deleguer aux Services
5. **TypeScript**: TOUJOURS typer les parametres et retours
6. **State management**: TOUJOURS gerer loading/error dans les stores Pinia
7. **Multi-tenancy**: TOUJOURS scope par entreprise_id
