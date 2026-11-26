# FORNATTO — Arquitetura do Monorepo (Fase 01)

SaaS multi-tenant para padarias e confeitarias. O código vive em `fornatto/` dentro do repositório Lexius, **isolado** do app financeiro existente.

## Visão geral

| Camada | Tecnologia | Responsabilidade |
|--------|------------|------------------|
| `apps/web` | Next.js 15 (App Router), React, TypeScript, Tailwind, shadcn/ui | Painel admin, autenticação via API, UI premium |
| `apps/api` | NestJS, Prisma, PostgreSQL | REST/JSON, multi-tenant, auth, assinaturas |
| `packages/*` | TypeScript compartilhado | Tipos, constantes, config ESLint/TS |
| Infra local | Docker Compose | PostgreSQL 16 (+ Redis reservado para fases futuras) |
| Mobile (futuro) | Expo React Native | App de balcão/produção — consome mesma API |

## Layout do monorepo

```
fornatto/
├── apps/
│   ├── api/                 # NestJS + Prisma
│   └── web/                 # Next.js
├── packages/
│   ├── shared/              # DTOs, enums, IDs de permissão
│   ├── eslint-config/       # ESLint compartilhado
│   └── tsconfig/            # bases TypeScript
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── README.md
├── AGENTS.md
└── docs/architecture.md     # espelho deste documento
```

## Modelo multi-tenant

- **Tenant lógico:** `Company` (empresa contratante do SaaS).
- **Escopo operacional:** `Branch` (unidade/filial) — dados operacionais futuros (vendas, estoque) serão filtrados por `companyId` + opcionalmente `branchId`.
- **Isolamento:** toda consulta/mutação no backend usa `companyId` resolvido do **JWT/sessão**, nunca de query/body do cliente sem validação cruzada com membership.
- **Membership:** `CompanyUser` liga usuário ↔ empresa com papel (`Role`).
- **Assinatura:** `SaasPlan` + `Subscription` por empresa (status, trial, limites futuros).

### Entidades principais (Fase 01)

- `Company`, `Branch`
- `User`, `CompanyUser`, `Role`, `Permission`, `RolePermission`
- `Session` (refresh / revogação)
- `SaasPlan`, `Subscription`
- `AuditLog` (ações sensíveis: login, troca de papel, etc.)

Índices em `companyId`, `userId`, `sessionId`, combinações únicas (`companyId` + `slug` em filial).

## Fluxo de autenticação

1. Cliente envia `POST /auth/login` (email + senha).
2. API valida credencial (bcrypt), carrega memberships ativas.
3. Se múltiplas empresas: resposta lista empresas; `POST /auth/select-company` fixa tenant no token.
4. Access JWT (curta duração) + refresh em `Session` (hash do refresh, TTL, `revokedAt`).
5. Guards NestJS: `JwtAuthGuard` → `TenantGuard` (injeta `request.tenant.companyId`).
6. Web armazena tokens em cookies httpOnly (futuro) ou memória em dev; Fase 01 prepara contratos.

Senhas: **argon2/bcrypt** (bcrypt na Fase 01). Nunca logar segredos.

## Boundaries da API

| Prefixo | Uso |
|---------|-----|
| `/auth/*` | Login, refresh, logout, seleção de empresa |
| `/companies/*` | Metadados da empresa logada (admin) |
| `/branches/*` | CRUD filiais (tenant-scoped) |
| `/health` | Liveness |
| `/dashboard/*` (futuro) | KPIs reais; Fase 01 web usa **mock demonstrativo** |

Validação: `class-validator` + `ValidationPipe` global. DTOs espelhados em `@fornatto/shared` quando estável.

## Web — identidade visual

Tokens Tailwind (tema FORNATTO):

- `fornatto-brown` (#3D2914) — fundo sidebar
- `fornatto-cream` (#F5E6D3) — superfícies
- `fornatto-gold` (#C9A227) — destaques, CTAs
- `fornatto-white` (#FFFFFF) — texto em fundo escuro

Layout: sidebar fixa + header com unidade ativa + área de conteúdo. Componentes base (Button, Card, Badge) no estilo shadcn/ui.

Dashboard admin Fase 01: **dados mock** via `lib/demo/dashboard-mock.ts`, rotulados como **Demonstrativo** na UI.

## Docker e variáveis de ambiente

### Docker Compose

- Serviço `postgres` na porta `5433` (host) para não colidir com Lexius.
- Volume nomeado `fornatto_pg_data`.

### Variáveis (`apps/api`)

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Prisma → PostgreSQL |
| `JWT_ACCESS_SECRET` | Assinatura access token |
| `JWT_REFRESH_SECRET` | Assinatura refresh token |
| `JWT_ACCESS_TTL` | Ex.: `15m` |
| `JWT_REFRESH_TTL` | Ex.: `7d` |
| `PORT` | Default `3333` |

### Variáveis (`apps/web`)

| Variável | Descrição |
|----------|-----------|
| `NEXT_PUBLIC_API_URL` | Base da API (ex. `http://localhost:3333`) |

## Expo RN (futuro)

- App em `apps/mobile` (não criado na Fase 01).
- Mesmos endpoints autenticados; tenant no JWT.
- Pacote `@fornatto/shared` versionado para tipos offline-first futuros.

## Segurança e auditoria

- `AuditLog`: `actorUserId`, `companyId`, `action`, `metadata` (JSON), `ip`, `createdAt`.
- Rate limit e 2FA: fases posteriores.
- Migrations Prisma versionadas; seed opcional com empresa demo.

## Decisões explícitas (Fase 01)

- Monorepo **pnpm**; Lexius raiz permanece **npm** — sem mistura de lockfiles.
- Dashboard web **não** finge integração real: camada demo claramente marcada.
- API entrega fundação tenant + auth; KPIs reais na Fase 02.