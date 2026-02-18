#!/bin/bash
# Hook de validation pour TresoPilot
# Bloque les commandes interdites et rappelle d'utiliser sail

# Lit le JSON en stdin et extrait la commande
CMD=$(cat | jq -r '.tool_input.command // empty')

# Patterns INTERDITS (basés sur l'historique réel des erreurs)
if echo "$CMD" | grep -qE '^php artisan|^composer '; then
  echo "❌ INTERDIT: 'php artisan' ou 'composer' direct !" >&2
  echo "✅ UTILISER: cd api && ./vendor/bin/sail artisan ..." >&2
  echo "✅ UTILISER: cd api && ./vendor/bin/sail composer ..." >&2
  exit 2
fi

if echo "$CMD" | grep -qE 'docker exec|docker-compose exec|docker compose exec'; then
  echo "❌ INTERDIT: docker exec / docker-compose exec !" >&2
  echo "✅ UTILISER: cd api && ./vendor/bin/sail ..." >&2
  exit 2
fi

if echo "$CMD" | grep -qE '\./vendor/bin/pest|\bpest\b' | grep -vq 'sail'; then
  # Vérifie si c'est pest sans sail
  if echo "$CMD" | grep -qE '\./vendor/bin/pest' && ! echo "$CMD" | grep -q 'sail'; then
    echo "❌ INTERDIT: ./vendor/bin/pest direct !" >&2
    echo "✅ UTILISER: cd api && ./vendor/bin/sail pest ..." >&2
    exit 2
  fi
fi

# OK - commande autorisée
exit 0
