#!/bin/bash
# Hook de validation des commandes Bash pour BMAD.
#
# Personnalisez ce fichier pour votre projet.
# Exemples de regles :
#   - Interdire "docker exec" si vous utilisez Docker Compose / Sail
#   - Interdire "php artisan" direct si vous utilisez un wrapper Docker
#   - Interdire "npm" si vous utilisez pnpm
#
# Pour activer des regles, decommentez les blocs ci-dessous et adaptez-les.

# Lire le JSON de l'outil depuis stdin
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('command',''))" 2>/dev/null)

# --- EXEMPLE : Interdire docker exec ---
# if echo "$COMMAND" | grep -qE '^\s*(docker exec|docker-compose exec)'; then
#     echo "INTERDIT : Utilisez votre wrapper Docker (ex: sail, docker compose run)" >&2
#     exit 2
# fi

# --- EXEMPLE : Interdire php/composer direct (pour Laravel Sail) ---
# if echo "$COMMAND" | grep -qE '^\s*(php |composer )'; then
#     echo "INTERDIT : Utilisez sail. Ex: cd api && ./vendor/bin/sail artisan ..." >&2
#     exit 2
# fi

# --- EXEMPLE : Interdire npm (forcer pnpm) ---
# if echo "$COMMAND" | grep -qE '^\s*npm '; then
#     echo "INTERDIT : Utilisez pnpm au lieu de npm" >&2
#     exit 2
# fi

# Tout OK par defaut
exit 0
