# Lexius Financeiro (API)

Módulo financeiro do grupo Lexius — **projeto independente** do Lexius iA e do Lexius Cobrança. Fonte da verdade funcional: `ESPECIFICACAO.md` e `schema.sql`.

## Fase 1 (esta entrega)

- Multiempresa, usuários e papéis (`MASTER`, `ADMIN`, `FINANCEIRO`, `OPERADOR`, `CONSULTA`)
- Plano de contas (categorias globais + por empresa)
- Pessoas, centros de custo, contas bancárias **somente manuais** (sem Inter/Asaas/C6)
- Integração COB: `POST /v1/integracao/cobranca/acordos` (idempotente por `codigo`; **201** na criação, **200** na repetição)

## Stack

Node.js + TypeScript (NestJS), PostgreSQL 15+, TypeORM.

## Configuração

1. Copie `.env.example` → `.env` e preencha.
2. Crie o banco e aplique o schema:

```bash
npm run db:migrate
```

Em banco **já existente**, aplique somente os arquivos incrementais em `migrations/` (ver `docs/MIGRATIONS.md`); `db:migrate` reaplica `schema.sql` inteiro e falha se o banco já foi inicializado.

3. (Opcional) dados iniciais de desenvolvimento:

```bash
npm run db:seed:dev
```

4. Testes e API:

```bash
npm install
npm test
npm run test:e2e   # Postgres; `scripts/reset-db.js` + seed
npm run start:dev
```

Prefixo global: `/v1`.

### Autenticação (usuários)

- `POST /v1/auth/login` — JWT Bearer nas demais rotas
- Header `X-Empresa-Id` nas rotas multiempresa (exceto listagem de empresas)

### Integração Lexius COB

`POST /v1/integracao/cobranca/acordos`

Headers:

- `X-Api-Key`: valor de `COB_INTEGRACAO_API_KEY`
- `X-Signature`: HMAC-SHA256 **hex** do corpo JSON bruto, usando `COB_INTEGRACAO_HMAC_SECRET`

Corpo: ver `ESPECIFICACAO.md` §3.1.1.

## Estrutura

```
├── ESPECIFICACAO.md
├── schema.sql
├── scripts/
│   ├── migrate.js
│   └── seed-dev.js
└── src/
    ├── main.ts
    ├── config/
    ├── database/          # entities + enums
    ├── common/            # guards, decorators, utils
    └── modules/
        ├── auth/
        ├── empresas/
        ├── usuarios/
        ├── pessoas/
        ├── categorias/
        ├── centros-custo/
        ├── departamentos/
        ├── contas-bancarias/
        └── integracao-cobranca/
```