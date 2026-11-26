# AGENTS.md — FORNATTO

## Escopo do monorepo

Trabalhe **somente** dentro de `fornatto/`. Não altere o Nest/Vite Lexius na raiz do repositório.

## Comandos

| Ação | Comando |
|------|---------|
| Install | `pnpm install` (na raiz `fornatto/`) |
| DB | `docker compose up -d` |
| Migrate | `pnpm --filter @fornatto/api exec prisma migrate dev` |
| Seed | `pnpm --filter @fornatto/api exec prisma db seed` |
| API dev | `pnpm --filter @fornatto/api dev` |
| Web dev | `pnpm --filter @fornatto/web dev` |
| Testes API | `pnpm --filter @fornatto/api test` |
| Testes web | `pnpm --filter @fornatto/web test` |

## Regras de tenant

- `companyId` vem **apenas** do JWT após `select-company`.
- Nunca confiar em `companyId` enviado pelo cliente em query/body para escopo de dados.
- Guards: `JwtAuthGuard` → `TenantGuard` → `PermissionsGuard` (quando aplicável).

## Fase 01 — limites

- Sem PDV, produção operacional ou financeiro real.
- Dashboard web usa `src/lib/demo/dashboard-mock.ts` (rótulo **Demonstrativo**).
- Login web consome API real (`/auth/login`, `/auth/select-company`).

## Portas

- Postgres: `5433` (host)
- API: `3333`
- Web: `3001`