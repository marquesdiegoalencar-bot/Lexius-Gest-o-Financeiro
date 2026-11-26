#!/bin/sh
# Corrige login (502 Bad Gateway). Rodar como root no VPS (SSH).
set -e
cd /tmp/Lexius-Gest-o-Financeiro
git pull origin main
PG_NAME=$(docker ps --format '{{.Names}}' | grep '^postgres-t139' | head -1)
PG_NET=t139wmkoppbj1hocvgslabxx
echo "Postgres: $PG_NAME | rede: $PG_NET"
if [ -z "$DATABASE_URL" ]; then
  echo "Defina DATABASE_URL antes (senha URL-encoded, host=$PG_NAME:5432)"
  exit 1
fi
export JWT_SECRET="${JWT_SECRET:-LexiusProdJwtSecretMin32CharsVps2026!}"
export COOLIFY_DB_NETWORK="$PG_NET"
export RUN_DB_MIGRATE="${RUN_DB_MIGRATE:-true}"
export RUN_DB_SEED="${RUN_DB_SEED:-true}"
docker compose -f docker-compose.production.shared-pg.yml -f deploy/docker-compose.vps-coolify.yml up -d --build
sleep 8
curl -s -o /dev/null -w "login HTTP %{http_code}\n" -X POST http://127.0.0.1:8081/v1/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"master@lexius.local","senha":"Lexius@123"}'