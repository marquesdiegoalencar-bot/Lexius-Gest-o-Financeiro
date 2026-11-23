# Deploy na VPS (Coolify + GitHub)

## Infraestrutura

- **VPS:** `46.202.93.186` (Coolify em `:8000`, SSH `:22`)
- **Acesso público inicial (sslip):** configure no Coolify o domínio  
  `http://46-202-93-186.sslip.io` (aponta para o IP sem DNS próprio)

## Passos no Coolify

1. **New Resource** → **Docker Compose**
2. **Source:** GitHub → `marquesdiegoalencar-bot/Lexius-Gest-o-Financeiro`
3. **Branch:** `main` (ou `cursor/contas-bancarias-cadastro-bafb` até merge)
4. **Compose file:** `docker-compose.production.yml`
5. **Domínio (web):** `46-202-93-186.sslip.io` (HTTP) ou gere um FQDN no Coolify
6. **Variáveis obrigatórias:**
   - `POSTGRES_PASSWORD` (senha forte)
   - `JWT_SECRET` (mín. 32 caracteres)
7. **Variáveis recomendadas:** `RUN_DB_SEED=true` na primeira subida, depois `false`
8. Deploy

## GitHub

O Coolify usa o **GitHub App** instalado no repositório (Settings → integrações no Coolify).
Cada push na branch configurada dispara novo deploy (webhook).

## PostgreSQL na VPS (compartilhado)

O banco **`lexius_financeiro`** foi criado no mesmo Postgres do **Lexius Cobrança** (Coolify).

- **DATABASE_URL:** definida no app Lexius Financeiro no Coolify (rede interna do container Postgres, porta `5432`).
- **Porta externa na VPS:** `3000` → Postgres (só para admin/túnel; prefira rede interna Coolify).
- Compose sem container Postgres: use  
  `docker-compose.production.yml` + `docker-compose.production.shared-pg.yml`

**Senha com `/` ou `@`:** use URL-encoding na `DATABASE_URL` (`/` → `%2F`, `@` → `%40`).

**Rede Docker:** serviço `api` precisa estar na mesma rede do Postgres. Defina `COOLIFY_DB_NETWORK` com o nome da rede do container Postgres (Coolify → Postgres → Network, ou `docker network ls`).

Recriar manualmente (terminal do Postgres na VPS):

```bash
psql -U postgres -f scripts/create-lexius-db.sql
```

## Stack

| Serviço  | Função                          |
|----------|---------------------------------|
| `postgres` | Banco embutido (omitir se shared-pg) |
| `api`    | NestJS `:3000` (migrations no start) |
| `web`    | SPA + nginx proxy `/v1` → API |

Login inicial (se `RUN_DB_SEED=true`): `master@lexius.local` / `Lexius@123`