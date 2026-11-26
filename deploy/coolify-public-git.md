# Coolify — corrigir Git e publicar (repo público)

O repositório está **público** na `main` (PR #13 mergeado). Se ainda aparece “Failed to read Git source”:

## Opção A — GitHub App (recomendado)

1. Coolify → **Sources** → **lexius-financeiro-github** → **Install/Reinstall on GitHub**
2. Autorize e marque o repo **Lexius-Gest-o-Financeiro**
3. App **Lexius Financeiro** → **Private Key (Source)** → selecione a GitHub App (não “localhost’s key”)
4. Repo: `marquesdiegoalencar-bot/Lexius-Gest-o-Financeiro`, branch **`main`**
5. Compose: `docker-compose.production.shared-pg.yml` → **Load Compose** → **Deploy**

## Opção B — Repositório público sem chave

1. Source: URL `https://github.com/marquesdiegoalencar-bot/Lexius-Gest-o-Financeiro.git`
2. Desmarque / remova private deploy key se houver opção
3. Branch `main`, compose `docker-compose.production.shared-pg.yml`

## Variáveis (Production)

| Variável | Valor |
|----------|--------|
| `DATABASE_URL` | Postgres compartilhado (já no Coolify) |
| `JWT_SECRET` | ≥ 32 caracteres |
| `RUN_DB_MIGRATE` | `true` (1ª vez) |
| `RUN_DB_SEED` | `true` (1ª vez), depois `false` |

## Domínio

Serviço **web** (porta 80 do container): `46-202-93-186.sslip.io`  
Ou temporário: `http://46.202.93.186:8081` (deploy manual em `/tmp`)

## Rede + DATABASE_URL

1. `DATABASE_URL` com host = **nome do container Postgres** (não IP) e senha **URL-encoded**
2. Env `COOLIFY_DB_NETWORK` = rede externa do Postgres (ver `docker network ls` no VPS)
3. Se API reiniciar: `docker network connect <rede-postgres> lexius-gest-o-financeiro-api-1`

**Atalho sem rede compartilhada:** Postgres do Lexius Cobrança expõe `3000:5432` no host. Use na `DATABASE_URL` o host `host.docker.internal` e porta `3000` (senha URL-encoded):

`postgresql://postgres:SENHA_ENCODED@host.docker.internal:3000/lexius_financeiro`

## SSH (se voltar a usar deploy key)

No servidor: `bash deploy/coolify-github-ssh.sh`