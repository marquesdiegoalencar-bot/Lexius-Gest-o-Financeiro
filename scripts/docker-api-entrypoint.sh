#!/bin/sh
set -e
if [ "${RUN_DB_MIGRATE:-true}" = "true" ]; then
  echo "Aplicando schema e migrations..."
  node scripts/migrate.js
fi
if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  node scripts/seed-dev.js || true
fi
exec node dist/main.js