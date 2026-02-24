#!/bin/bash
# ============================================================================
# BMAD Starter Kit — Setup interactif
# ============================================================================
# Lance ce script dans la racine de ton projet apres avoir copie le starter kit.
# Il configure automatiquement les chemins et genere le CLAUDE.md.
# ============================================================================

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BOLD}${BLUE}"
echo "============================================"
echo "  BMAD Starter Kit — Configuration"
echo "============================================"
echo -e "${NC}"

# --- Detection automatique ---
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_PROJECT_NAME="$(basename "$PROJECT_ROOT")"

# --- Questions ---
echo -e "${BOLD}1. Nom du projet${NC}"
read -p "   [$DEFAULT_PROJECT_NAME] : " PROJECT_NAME
PROJECT_NAME="${PROJECT_NAME:-$DEFAULT_PROJECT_NAME}"

echo ""
echo -e "${BOLD}2. Chemin racine du projet${NC}"
read -p "   [$PROJECT_ROOT] : " CUSTOM_ROOT
PROJECT_ROOT="${CUSTOM_ROOT:-$PROJECT_ROOT}"

echo ""
echo -e "${BOLD}3. Stack technique${NC}"
echo "   1) Laravel + Vue 3 (PHP + TypeScript)"
echo "   2) Next.js (TypeScript)"
echo "   3) Django + React (Python + TypeScript)"
echo "   4) Rails + React (Ruby + TypeScript)"
echo "   5) Express + React (Node + TypeScript)"
echo "   6) Autre (personnalise)"
read -p "   Choix [1-6] : " STACK_CHOICE

case $STACK_CHOICE in
    1) STACK="Laravel 12 + Vue 3 + TypeScript + Pinia + Tailwind CSS"
       BACKEND_DIR="api"
       FRONTEND_DIR="frontend"
       TEST_BACKEND="cd $BACKEND_DIR && ./vendor/bin/sail pest"
       TEST_FRONTEND="cd $FRONTEND_DIR && npm run test"
       TEST_E2E="cd e2e && npx playwright test"
       DOCKER_TOOL="Laravel Sail"
       ;;
    2) STACK="Next.js + TypeScript + Tailwind CSS"
       BACKEND_DIR="."
       FRONTEND_DIR="."
       TEST_BACKEND="npm run test"
       TEST_FRONTEND="npm run test"
       TEST_E2E="npx playwright test"
       DOCKER_TOOL=""
       ;;
    3) STACK="Django + React + TypeScript"
       BACKEND_DIR="backend"
       FRONTEND_DIR="frontend"
       TEST_BACKEND="cd $BACKEND_DIR && python manage.py test"
       TEST_FRONTEND="cd $FRONTEND_DIR && npm run test"
       TEST_E2E="cd e2e && npx playwright test"
       DOCKER_TOOL="Docker Compose"
       ;;
    4) STACK="Rails + React + TypeScript"
       BACKEND_DIR="backend"
       FRONTEND_DIR="frontend"
       TEST_BACKEND="cd $BACKEND_DIR && bundle exec rspec"
       TEST_FRONTEND="cd $FRONTEND_DIR && npm run test"
       TEST_E2E="cd e2e && npx playwright test"
       DOCKER_TOOL="Docker Compose"
       ;;
    5) STACK="Express + React + TypeScript"
       BACKEND_DIR="server"
       FRONTEND_DIR="client"
       TEST_BACKEND="cd $BACKEND_DIR && npm run test"
       TEST_FRONTEND="cd $FRONTEND_DIR && npm run test"
       TEST_E2E="cd e2e && npx playwright test"
       DOCKER_TOOL="Docker Compose"
       ;;
    6) echo ""
       read -p "   Stack technique : " STACK
       read -p "   Repertoire backend : " BACKEND_DIR
       read -p "   Repertoire frontend : " FRONTEND_DIR
       read -p "   Commande tests backend : " TEST_BACKEND
       read -p "   Commande tests frontend : " TEST_FRONTEND
       read -p "   Commande tests E2E : " TEST_E2E
       read -p "   Outil Docker (vide si aucun) : " DOCKER_TOOL
       ;;
    *) echo "Choix invalide"; exit 1 ;;
esac

echo ""
echo -e "${BOLD}4. Utilisez-vous Docker ?${NC}"
if [ -n "$DOCKER_TOOL" ]; then
    read -p "   [$DOCKER_TOOL] (o/n) [o] : " USE_DOCKER
    USE_DOCKER="${USE_DOCKER:-o}"
else
    read -p "   (o/n) [n] : " USE_DOCKER
    USE_DOCKER="${USE_DOCKER:-n}"
fi

echo ""
echo -e "${BOLD}5. Langue de communication${NC}"
echo "   1) Francais"
echo "   2) English"
read -p "   Choix [1-2] : " LANG_CHOICE
case $LANG_CHOICE in
    2) LANG="English" ;;
    *) LANG="Francais" ;;
esac

# --- Configuration des fichiers ---

echo ""
echo -e "${BOLD}${GREEN}Configuration en cours...${NC}"

# 1. config.py
CONFIG_FILE="$PROJECT_ROOT/.claude/scripts/config.py"
if [ -f "$CONFIG_FILE" ]; then
    sed -i "s|__PROJECT_ROOT__|$PROJECT_ROOT|g" "$CONFIG_FILE"
    echo -e "  ${GREEN}[OK]${NC} .claude/scripts/config.py"
fi

# 2. CLAUDE.md
CLAUDE_FILE="$PROJECT_ROOT/CLAUDE.md"
if [ -f "$PROJECT_ROOT/CLAUDE.md.template" ]; then
    cp "$PROJECT_ROOT/CLAUDE.md.template" "$CLAUDE_FILE"
    sed -i "s|__PROJECT_NAME__|$PROJECT_NAME|g" "$CLAUDE_FILE"
    sed -i "s|__PROJECT_ROOT__|$PROJECT_ROOT|g" "$CLAUDE_FILE"
    sed -i "s|__STACK__|$STACK|g" "$CLAUDE_FILE"
    sed -i "s|__BACKEND_DIR__|$BACKEND_DIR|g" "$CLAUDE_FILE"
    sed -i "s|__FRONTEND_DIR__|$FRONTEND_DIR|g" "$CLAUDE_FILE"
    sed -i "s|__TEST_BACKEND__|$TEST_BACKEND|g" "$CLAUDE_FILE"
    sed -i "s|__TEST_FRONTEND__|$TEST_FRONTEND|g" "$CLAUDE_FILE"
    sed -i "s|__TEST_E2E__|$TEST_E2E|g" "$CLAUDE_FILE"
    echo -e "  ${GREEN}[OK]${NC} CLAUDE.md"
fi

# 3. settings.json — mettre le chemin absolu du validate-bash.sh
SETTINGS_FILE="$PROJECT_ROOT/.claude/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
    sed -i "s|.claude/validate-bash.sh|$PROJECT_ROOT/.claude/validate-bash.sh|g" "$SETTINGS_FILE"
    echo -e "  ${GREEN}[OK]${NC} .claude/settings.json"
fi

# 4. Setup Python venv pour les scripts
echo ""
echo -e "${BOLD}6. Configurer l'environnement Python pour les scripts d'orchestration ?${NC}"
read -p "   (o/n) [o] : " SETUP_VENV
SETUP_VENV="${SETUP_VENV:-o}"

if [ "$SETUP_VENV" = "o" ] || [ "$SETUP_VENV" = "O" ]; then
    SCRIPTS_DIR="$PROJECT_ROOT/.claude/scripts"
    echo -e "  Creation du venv..."
    python3 -m venv "$SCRIPTS_DIR/.venv"
    "$SCRIPTS_DIR/.venv/bin/pip" install -q -r "$SCRIPTS_DIR/requirements.txt"
    echo -e "  ${GREEN}[OK]${NC} Python venv installe"
fi

# 5. Nettoyage
if [ -f "$PROJECT_ROOT/CLAUDE.md.template" ]; then
    rm "$PROJECT_ROOT/CLAUDE.md.template"
    echo -e "  ${GREEN}[OK]${NC} CLAUDE.md.template supprime (CLAUDE.md genere)"
fi

# --- Resume ---

echo ""
echo -e "${BOLD}${GREEN}============================================"
echo "  Configuration terminee !"
echo "============================================${NC}"
echo ""
echo -e "  Projet    : ${BOLD}$PROJECT_NAME${NC}"
echo -e "  Racine    : $PROJECT_ROOT"
echo -e "  Stack     : $STACK"
echo -e "  Langue    : $LANG"
echo ""
echo -e "${BOLD}Fichiers configures :${NC}"
echo "  - CLAUDE.md             (instructions projet)"
echo "  - .claude/scripts/      (orchestration Python)"
echo "  - .claude/agents/       (15 agents BMAD + tech-writer)"
echo "  - .claude/commands/     (22 slash commands)"
echo "  - .claude/skills/       (3 skills UX)"
echo "  - _bmad/                (BMAD v6 framework)"
echo ""
echo -e "${BOLD}Prochaines etapes :${NC}"
echo "  1. Editez ${YELLOW}CLAUDE.md${NC} pour ajouter vos regles specifiques"
echo "  2. Editez ${YELLOW}.claude/scripts/agents.py${NC} pour personnaliser les regles des agents"
echo "  3. Editez ${YELLOW}.claude/validate-bash.sh${NC} pour activer les hooks de validation"
echo "  4. Lancez ${YELLOW}/bmad-help${NC} dans Claude Code pour decouvrir les commandes"
echo ""
echo -e "${BOLD}Commandes BMAD disponibles :${NC}"
echo "  /product-brief          Creer un product brief"
echo "  /create-prd             Creer un PRD"
echo "  /create-architecture    Concevoir l'architecture"
echo "  /create-epics-and-stories  Decouper en epics/stories"
echo "  /sprint-planning        Planifier un sprint"
echo "  /create-story           Creer une story detaillee"
echo "  /dev-story              Implementer une story"
echo "  /code-review            Review du code"
echo "  /qa-automate            Tests automatises"
echo "  /pipeline               Pipeline TDD+BMAD (feature + bug mode)"
echo "  /sprint-status          Vue d'avancement"
echo "  /retrospective          Retrospective post-epic"
echo ""
echo -e "${YELLOW}Tip : Supprimez setup.sh apres la configuration.${NC}"
