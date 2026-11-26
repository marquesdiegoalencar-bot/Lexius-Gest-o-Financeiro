# FORNATTO

SaaS multi-tenant para padarias — monorepo **isolado** do app Lexius na raiz do repositório.

## Pré-requisitos

- Node.js 20+
- pnpm 10+
- Docker (PostgreSQL)

## Instalação

```bash
cd fornatto
pnpm install
cp apps/api/.env.example apps/api/.env
docker compose up -d
pnpm --filter @fornatto/api exec prisma migrate dev --name init
pnpm --filter @fornatto/api exec prisma db seed
```

## Desenvolvimento

```bash
# API (porta 3333)
pnpm --filter @fornatto/api dev

# Web (porta 3001)
pnpm --filter @fornatto/web dev
```

Credenciais demo (seed): `admin@fornatto.app` / `fornatto123`

## Testes

```bash
pnpm --filter @fornatto/api test
pnpm --filter @fornatto/web test
pnpm build
```

## Estrutura

- `apps/api` — NestJS, Prisma, PostgreSQL, auth multi-tenant
- `apps/web` — Next.js, painel admin (dashboard com dados **demonstrativos**)
- `packages/shared` — tipos e constantes compartilhadas

Documentação detalhada: `docs/architecture.md` e `AGENTS.md`.