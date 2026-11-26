#!/bin/sh
# Corrige login (502 Bad Gateway): API + Postgres na mesma rede Docker.
# Execute como root no VPS (SSH), não só no terminal web do Coolify.
set -e
API=lexius-gest-o-financeiro-api-1
PG_NET=$(docker inspect "$(docker ps -q -f name=postgres-t139)" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null | head -1)
if [ -z "$PG_NET" ]; then
  echo "Não achei container Postgres. Liste: docker ps | grep -i postgres"
  exit 1
fi
echo "Rede Postgres: $PG_NET"
docker network connect "$PG_NET" "$API" 2>/dev/null || echo "Já conectado ou erro (verifique)"
echo "Defina DATABASE_URL no Coolify com host = nome do container Postgres, porta 5432, senha URL-encoded."
echo "Recrie API: cd /tmp/Lexius-Gest-o-Financeiro && docker compose -f docker-compose.production.shared-pg.yml up -d api"