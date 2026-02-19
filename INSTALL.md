# Installation & Guide de lancement — testApp

## Table des matieres

- [Prerequis](#prerequis)
- [Installation rapide](#installation-rapide)
- [Installation manuelle](#installation-manuelle)
- [Lancement des services](#lancement-des-services)
  - [Tout-en-un (script start)](#tout-en-un-script-start)
  - [API (Laravel + Sail)](#api-laravel--sail)
  - [Base de donnees (MySQL)](#base-de-donnees-mysql)
  - [Redis (Cache/Sessions)](#redis-cachesessions)
  - [OCR (Extraction PDF)](#ocr-extraction-pdf)
  - [Frontend (Vue 3 + Vite)](#frontend-vue-3--vite)
  - [Queue Worker (Jobs)](#queue-worker-jobs)
- [Tests](#tests)
- [Pipeline BMAD (Agents IA)](#pipeline-bmad-agents-ia)
  - [dev_sprint.py — Cycle Dev/Review/QA](#dev_sprintpy--cycle-devreviewqa)
  - [pipeline.py — Pipeline TDD+BMAD](#pipelinepy--pipeline-tddbmad)
  - [Commandes BMAD dans Claude Code](#commandes-bmad-dans-claude-code)
- [Arborescence des fichiers utiles](#arborescence-des-fichiers-utiles)
- [Ports et acces](#ports-et-acces)
- [Depannage](#depannage)

---

## Prerequis

| Outil | Version minimale | Verification |
|-------|-----------------|--------------|
| **Docker** | 24+ | `docker --version` |
| **Docker Compose** | v2+ (plugin) | `docker compose version` |
| **Node.js** | 20+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **Python** | 3.11+ | `python3 --version` |

> Docker doit etre demarre avant de lancer le projet.

---

## Installation rapide

Depuis la racine du projet :

```bash
cd /home/thibaut/Bureau/testApp
chmod +x start
./start
```

Ce script fait tout automatiquement :
1. Verifie les prerequis (Docker, Node, Sail)
2. Installe les dependances backend (`composer install` via Docker)
3. Installe les dependances frontend (`npm install`)
4. Demarre les containers Docker (API, MySQL, Redis, OCR, Queue)
5. Attend que MySQL soit pret (healthcheck, 60s max)
6. Lance les migrations
7. Genere la `APP_KEY` si absente
8. Demarre le serveur frontend Vite

A la fin, le terminal affiche les URLs d'acces.

---

## Installation manuelle

### 1. Cloner le projet

```bash
git clone <url-du-repo> testApp
cd testApp
```

### 2. Installer les dependances backend

Si le dossier `api/vendor/` n'existe pas :

```bash
docker run --rm -u "$(id -u):$(id -g)" \
    -v "$PWD/api:/var/www/html" -w /var/www/html \
    laravelsail/php84-composer:latest \
    composer install --ignore-platform-reqs
```

### 3. Configurer l'environnement backend

```bash
# Copier .env.example si .env n'existe pas
cp api/.env.example api/.env
```

Variables cles dans `api/.env` :

| Variable | Valeur par defaut | Description |
|----------|------------------|-------------|
| `APP_PORT` | `8080` | Port de l'API sur l'hote |
| `DB_HOST` | `mysql` | Nom DNS Docker interne |
| `DB_PORT` | `3306` | Port MySQL interne |
| `DB_DATABASE` | `testapp` | Nom de la base |
| `DB_USERNAME` | `sail` | Utilisateur MySQL |
| `DB_PASSWORD` | `password` | Mot de passe MySQL |
| `FORWARD_DB_PORT` | `3307` | Port MySQL expose sur l'hote |
| `FORWARD_REDIS_PORT` | `6379` | Port Redis expose sur l'hote |
| `FORWARD_OCR_PORT` | `8089` | Port OCR expose sur l'hote |

### 4. Installer les dependances frontend

```bash
cd frontend
npm install
```

### 5. Installer les dependances E2E (optionnel)

```bash
cd e2e
npm install
npx playwright install --with-deps
```

### 6. Installer les dependances Python pour la pipeline (optionnel)

```bash
cd .claude/scripts
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Dependances Python :
- `claude-agent-sdk>=0.1.30` — SDK pour orchestrer les agents Claude
- `pyyaml>=6.0` — Lecture/ecriture YAML

---

## Lancement des services

### Tout-en-un (script start)

```bash
./start
```

Demarre tout et garde le terminal ouvert sur le frontend. `Ctrl+C` arrete seulement Vite ; les containers Docker continuent de tourner.

---

### API (Laravel + Sail)

**REGLE : toutes les commandes PHP/Laravel passent par Sail depuis `api/`.**

```bash
cd api

# Demarrer tous les containers (API + MySQL + Redis + OCR + Queue)
./vendor/bin/sail up -d

# Arreter tous les containers
./vendor/bin/sail down

# Voir les logs
./vendor/bin/sail logs              # Tous les services
./vendor/bin/sail logs laravel.test # API seulement
./vendor/bin/sail logs -f           # Suivre en temps reel

# Voir les containers actifs
./vendor/bin/sail ps
```

Commandes Laravel courantes :

```bash
cd api

# Migrations
./vendor/bin/sail artisan migrate
./vendor/bin/sail artisan migrate:fresh --seed   # Reset + seed

# Seed
./vendor/bin/sail artisan db:seed

# Generer la cle
./vendor/bin/sail artisan key:generate

# Tinker (REPL)
./vendor/bin/sail php artisan tinker

# Composer
./vendor/bin/sail composer install
./vendor/bin/sail composer require <package>

# Cache
./vendor/bin/sail artisan config:cache
./vendor/bin/sail artisan route:cache
```

> **INTERDIT** : `php artisan ...`, `composer ...`, `docker exec ...` directement. Le PHP local est different du PHP dans Docker (8.4).

---

### Base de donnees (MySQL)

MySQL 8.4 demarre automatiquement avec Sail.

```bash
# Connexion depuis l'hote (client MySQL local)
mysql -h 127.0.0.1 -P 3307 -u sail -ppassword testapp

# Connexion depuis le container
cd api && ./vendor/bin/sail mysql
```

| Parametre | Valeur |
|-----------|--------|
| Hote (depuis l'hote) | `127.0.0.1:3307` |
| Hote (depuis Docker) | `mysql:3306` |
| Base | `testapp` |
| Utilisateur | `sail` |
| Mot de passe | `password` |

Les donnees sont persistees dans le volume Docker `sail-mysql`.

---

### Redis (Cache/Sessions)

Redis Alpine demarre automatiquement avec Sail.

```bash
# Connexion depuis l'hote
redis-cli -h 127.0.0.1 -p 6379

# Depuis le container
cd api && ./vendor/bin/sail redis
```

| Parametre | Valeur |
|-----------|--------|
| Hote (depuis l'hote) | `127.0.0.1:6379` |
| Hote (depuis Docker) | `redis:6379` |
| Mot de passe | aucun |

---

### OCR (Extraction PDF)

Service Flask/Gunicorn encapsulant OCRmyPDF. Demarre automatiquement avec Sail.

```bash
# Verifier que le service est UP
curl http://localhost:8089/health
# Reponse attendue : {"status": "ok"}

# Extraire du texte d'un PDF
curl -X POST http://localhost:8089/extract/pdf \
  -F "file=@mon-document.pdf"
# Reponse : {"text": "...", "pages": 3}
```

| Parametre | Valeur |
|-----------|--------|
| URL (depuis l'hote) | `http://localhost:8089` |
| URL (depuis Docker) | `http://ocr:8000` |
| Langues OCR | Francais + Anglais |
| Taille max fichier | 50 Mo |
| Timeout | 300s |
| Workers Gunicorn | 2 |

Endpoints :
- `GET /health` — Healthcheck
- `POST /extract/pdf` — Upload multipart, champ `file`

---

### Frontend (Vue 3 + Vite)

```bash
cd frontend

# Demarrer le serveur de dev
npm run dev

# Build production
npm run build

# Lancer les tests unitaires (Vitest)
npm run test
```

Le serveur Vite est accessible sur `http://localhost:5173`.

---

### Queue Worker (Jobs)

Le worker de queue demarre automatiquement avec `sail up`. Il utilise Redis comme driver et relance automatiquement les jobs echoues (3 tentatives, timeout 120s).

Pour monitorer :

```bash
cd api
./vendor/bin/sail logs queue -f
```

---

## Tests

### Tests Backend (Pest)

```bash
cd api

# Tous les tests
./vendor/bin/sail pest

# Un fichier specifique
./vendor/bin/sail pest tests/Feature/NomDuTest.php

# Par nom de test
./vendor/bin/sail pest --filter="nom du test"

# En parallele
./vendor/bin/sail pest --parallel
```

> **INTERDIT** : `./vendor/bin/pest` directement (PHP local != PHP Docker).

### Tests Frontend (Vitest)

```bash
cd frontend
npm run test
```

### Tests E2E (Playwright)

```bash
cd e2e

# Tous les tests
npm run test

# Avec interface graphique
npm run test:ui

# Avec navigateur visible
npm run test:headed

# Mode debug
npm run test:debug
```

Configuration E2E (`.env` dans `e2e/`) :

| Variable | Valeur |
|----------|--------|
| `API_URL` | `http://localhost:8080/api` |
| `APP_URL` | `http://localhost:5176` |
| `DB_HOST` | `127.0.0.1` |
| `DB_PORT` | `3307` |

---

## Pipeline BMAD (Agents IA)

Le projet utilise deux scripts Python pour orchestrer des agents Claude qui implementent, reviewent et testent automatiquement les stories.

### Prerequis pipeline

```bash
cd .claude/scripts
source .venv/bin/activate    # Activer le venv Python
```

Le SDK Claude Agent doit etre configure avec une cle API valide.

---

### dev_sprint.py — Cycle Dev/Review/QA

Script classique : **Dev -> Code Review -> QA -> Fix loop**.

```bash
cd .claude/scripts

# Lister les stories et leur statut
python dev_sprint.py --list

# Lancer le cycle pour une story
python dev_sprint.py <story-id>

# Lancer toutes les stories en ready-for-dev
python dev_sprint.py --all
```

**Cycle execute :**

```
1. Charge la story depuis US/{story-id}/{story-id}.md
2. Met le statut a "in-progress" dans sprint-status.yaml
3. PHASE DEV      → Agent dev implemente la story
4. PHASE REVIEW   → Agent reviewer verifie le code
   └─ Si FAIL → relance DEV avec le feedback (max 3 iterations)
5. PHASE QA       → Agent QA genere et execute les tests
   └─ Si FAIL → relance DEV avec le feedback (max 3 iterations)
6. Si tout PASS   → statut "done"
   Si max atteint → statut "review" (intervention humaine)
```

**Fichiers generes :**
- `_bmad-output/reviews/{story-id}-review.md` — Rapport de code review
- `_bmad-output/reviews/{story-id}-qa.md` — Rapport QA
- `.claude/scripts/logs/dev_sprint_*.log` — Logs complets

---

### pipeline.py — Pipeline TDD+BMAD

Pipeline avance avec TDD et diagnostic Sherlock progressif.

```bash
cd .claude/scripts

# Lancer le pipeline pour une story
python pipeline.py <story-id>

# Voir l'etat du pipeline
python pipeline.py --status

# Reprendre une story interrompue
python pipeline.py --resume <story-id>
```

**Phases du pipeline :**

```
1. FRONT MINIMAL  → Coquille interactive (facade Vue)
2. PHOENIX TDD    → Ecriture des tests Playwright AVANT implementation
3. DEV PARALLELE  → Dev Front + Dev Back simultanes
4. TESTS          → Execution des tests Playwright
5. SHERLOCK       → Si echec : diagnostic progressif (4 niveaux)
   └─ Fix + retest en boucle jusqu'a PASS ou escalade humaine
```

**Niveaux Sherlock :**
| Niveau | Action |
|--------|--------|
| 1 | Analyse rapide des erreurs |
| 2 | Investigation approfondie |
| 3 | Analyse architecturale |
| 4 | Escalade humaine (arret) |

**Fichiers generes :**
- `_bmad-output/pipeline-state.yaml` — Etat persistant du pipeline
- `US/{story-id}/sherlock-report.md` — Rapport Sherlock cumulatif
- `.claude/scripts/logs/pipeline_*.log` — Logs complets

---

### Commandes BMAD dans Claude Code

Ces commandes sont utilisables directement dans une session Claude Code :

| Commande | Description |
|----------|-------------|
| `/bmad-help` | Aide generale BMAD |
| `/sprint-planning` | Planifier un sprint |
| `/sprint-status` | Vue d'ensemble du sprint |
| `/create-story` | Creer une story detaillee |
| `/dev-story` | Implementer une story |
| `/code-review` | Review du code |
| `/qa-automate` | Generer des tests |
| `/quick-spec` | Spec rapide pour petits changements |
| `/product-brief` | Creer un product brief |
| `/create-prd` | Creer un PRD |
| `/create-architecture` | Architecture technique |
| `/create-epics-and-stories` | Decoupage en epics/stories |
| `/correct-course` | Changement mid-sprint |
| `/retrospective` | Retro post-epic |
| `/pattern-review` | Detecter les patterns recurrents |
| `/party-mode` | Discussion multi-agents |

---

## Arborescence des fichiers utiles

```
testApp/
│
├── start                              # Script de demarrage tout-en-un
├── CLAUDE.md                          # Regles du projet pour Claude Code
├── INSTALL.md                         # Ce fichier
│
├── docker/
│   ├── compose.yaml                   # Docker Compose (5 services)
│   └── ocr/
│       ├── Dockerfile                 # Image OCR (OCRmyPDF + Flask)
│       └── server.py                  # Microservice OCR (Flask/Gunicorn)
│
├── api/                               # Backend Laravel 12
│   ├── .env                           # Config environnement backend
│   ├── vendor/bin/sail                # CLI Sail (point d'entree obligatoire)
│   ├── bootstrap/                     # Bootstrap Laravel
│   ├── database/                      # Migrations, seeders, SQLite
│   └── storage/
│       ├── logs/                      # Logs Laravel
│       ├── oauth-private.key          # Cle privee Passport
│       └── oauth-public.key           # Cle publique Passport
│
├── frontend/                          # Frontend Vue 3 + TypeScript
│   ├── src/                           # Code source Vue
│   │   └── components/                # Composants Vue (.vue)
│   ├── dist/                          # Build de production
│   └── node_modules/                  # Dependances npm
│
├── e2e/                               # Tests End-to-End
│   ├── package.json                   # Dependances E2E (Playwright)
│   ├── .env                           # Config E2E (URLs, DB)
│   └── .env.example                   # Template config E2E
│
├── _bmad/                             # Framework BMAD v6
│   ├── core/                          # Core BMAD
│   │   ├── agents/                    # Definitions agents core
│   │   ├── tasks/                     # Templates de taches
│   │   └── workflows/                 # Workflows core (20+)
│   └── bmm/                           # Business Methods Module
│       ├── workflows/                 # Workflows metier (24+)
│       ├── teams/                     # Definitions d'equipes
│       └── data/                      # Templates de donnees
│
├── _bmad-output/                      # Sorties generees par BMAD
│   ├── sprint-status.yaml             # Source de verite sprint
│   ├── pipeline-state.yaml            # Etat du pipeline TDD
│   ├── logs/                          # Logs de sprint
│   ├── reviews/                       # Rapports review + QA
│   └── stories/                       # Stories generees
│
├── US/                                # User Stories (input pipeline)
│   └── {story-id}/
│       ├── {story-id}.md              # Definition de la story
│       └── sherlock-report.md         # Rapport diagnostic (si genere)
│
└── .claude/                           # Integration Claude Code
    ├── agents/                        # 16 agents specialises
    │   ├── dev.agent.yaml             # Agent developpeur
    │   ├── reviewer.agent.yaml        # Agent code review
    │   ├── qa.agent.yaml              # Agent QA
    │   ├── architect.agent.yaml       # Agent architecte
    │   ├── pm.agent.yaml              # Agent product manager
    │   ├── sm.agent.yaml              # Agent scrum master
    │   ├── analyst.agent.yaml         # Agent analyste
    │   ├── front-minimal.agent.yaml   # Agent facade front
    │   ├── e2e-qa.agent.yaml          # Agent tests E2E
    │   ├── e2e-diagnostic.agent.yaml  # Agent diagnostic E2E
    │   ├── pattern-reviewer.agent.yaml# Agent detection patterns
    │   ├── ux-designer.agent.yaml     # Agent UX
    │   ├── quick-flow-solo-dev.agent.yaml # Agent solo rapide
    │   └── tea.agent.yaml             # Agent test engineer
    ├── commands/                       # Slash commands BMAD
    ├── skills/                         # Skills specialisees
    │   └── ux-production/             # Skill UX production
    ├── scripts/                        # Orchestration Python
    │   ├── dev_sprint.py              # Orchestrateur Dev/Review/QA
    │   ├── pipeline.py                # Pipeline TDD+BMAD+Sherlock
    │   ├── agent_runner.py            # Execution agents (SDK)
    │   ├── agents.py                  # Definitions des agents
    │   ├── config.py                  # Configuration (chemins, modeles)
    │   ├── requirements.txt           # Dependances Python
    │   ├── .venv/                     # Environnement virtuel Python
    │   └── logs/                      # Logs d'execution
    ├── settings.json                   # Hooks pre-execution Bash
    └── validate-bash.sh               # Validateur commandes Bash
```

---

## Ports et acces

| Service | URL depuis l'hote | Port interne Docker |
|---------|-------------------|---------------------|
| **API Laravel** | `http://localhost:8080` | `laravel.test:80` |
| **Frontend Vite** | `http://localhost:5173` | `laravel.test:5173` |
| **MySQL** | `127.0.0.1:3307` | `mysql:3306` |
| **Redis** | `127.0.0.1:6379` | `redis:6379` |
| **OCR** | `http://localhost:8089` | `ocr:8000` |

---

## Depannage

### Les containers ne demarrent pas

```bash
# Verifier que Docker tourne
docker info

# Verifier les ports occupes
lsof -i :8080
lsof -i :3307
lsof -i :6379
lsof -i :8089
```

### MySQL ne repond pas

```bash
# Verifier le healthcheck
docker inspect --format='{{.State.Health.Status}}' api-mysql-1

# Voir les logs MySQL
cd api && ./vendor/bin/sail logs mysql
```

### Erreur "Sail introuvable"

```bash
# Reinstaller les dependances backend
docker run --rm -u "$(id -u):$(id -g)" \
    -v "$PWD/api:/var/www/html" -w /var/www/html \
    laravelsail/php84-composer:latest \
    composer install --ignore-platform-reqs
```

### Le frontend ne demarre pas

```bash
cd frontend
rm -rf node_modules
npm install
npm run dev
```

### L'OCR retourne des erreurs

```bash
# Verifier le healthcheck
curl http://localhost:8089/health

# Voir les logs OCR
cd api && ./vendor/bin/sail logs ocr
```

### Probleme avec la pipeline Python

```bash
cd .claude/scripts

# Verifier le venv
source .venv/bin/activate
python -c "import claude_agent_sdk; print('OK')"

# Reconstruire le venv si besoin
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
