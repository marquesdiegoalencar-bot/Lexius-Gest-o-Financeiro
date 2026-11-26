#!/bin/sh
set -e
if [ "${RUN_DB_MIGRATE:-true}" = "true" ]; then
  echo "Aplicando schema e migrations..."
  node scripts/migrate.js
fi
if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  if [ "${SEED_FORCE_PASSWORD:-true}" = "true" ] && [ "${NODE_ENV:-}" = "production" ]; then
    export SEED_FORCE_PASSWORD=true
  fi
  node scripts/seed-dev.js || true
fi
exec node dist/main.js