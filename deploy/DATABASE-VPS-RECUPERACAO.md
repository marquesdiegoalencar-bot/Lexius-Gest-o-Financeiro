# Recuperar Lexius na VPS (porta 8081)

## Sintoma
`ERR_CONNECTION_TIMED_OUT` em `http://46.202.93.186:8081` — containers parados ou API em loop.

## SSH no VPS (root)

### 1. Subir stack

```bash
cd /tmp/Lexius-Gest-o-Financeiro || (cd /tmp && git clone -b main --depth 1 https://github.com/marquesdiegoalencar-bot/Lexius-Gest-o-Financeiro.git)
cd /tmp/Lexius-Gest-o-Financeiro && git pull origin main
```

### 2. `DATABASE_URL` (escolha **uma**)

**A — Mesma rede Docker do Postgres (preferida após `network connect`):**

```text
postgresql://postgres:SENHA_ENCODED@postgres-t139wmkoppbj1hocvgslabxx-222811289205:5432/lexius_financeiro
```

Antes: `docker network connect t139wmkoppbj1hocvgslabxx lexius-gest-o-financeiro-api-1`

**B — Postgres exposto na porta 3000 do host:**

```text
postgresql://postgres:SENHA_ENCODED@host.docker.internal:3000/lexius_financeiro
```

Codifique na senha: `/` → `%2F`, `+` → `%2B`, `@` → `%40`

### 3. Deploy

```bash
export DATABASE_URL='...'
export JWT_SECRET='LexiusProdJwtSecretMin32CharsVps2026!'
export COOLIFY_PORT=8081
export RUN_DB_MIGRATE=true RUN_DB_SEED=true SEED_FORCE_PASSWORD=true
bash deploy/vps-fix-api-login.sh
```

### 4. Usuário Diego

```bash
docker compose -f docker-compose.production.shared-pg.yml -f deploy/docker-compose.vps-coolify.yml exec -T \
  -e ADMIN_EMAIL=marquesdiegoalencar@gmail.com -e 'ADMIN_SENHA=...' -e ADMIN_NOME='Diego Marques' \
  api node scripts/create-usuario.js
```

### 5. Teste

`curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8081/login` → **200**