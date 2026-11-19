# Migrations PostgreSQL — Lexius Financeiro

## Mecanismo

- Arquivos em `migrations/*.sql`, executados em **ordem lexicográfica** (`001`, `002`, …).
- **Não há** tabela `schema_migrations`: o controle é pela convenção de numeração e pelo processo operacional.
- `scripts/migrate.js`: aplica `schema.sql` e, em seguida, todos os `.sql` da pasta (banco **vazio** ou recriação completa).
- `scripts/reset-db.js` (e2e): `DROP SCHEMA` → `schema.sql` → migrations `001`… (idempotência onde previsto).
- Banco **já existente** em staging/produção: aplicar **somente** o arquivo incremental novo (ex.: `011_…sql`), **sem** rerodar `schema.sql` inteiro (falha em enums/tabelas já criados).

## Sequência reservada (pacote B–G)

| Arquivo | Conteúdo |
|---------|----------|
| `010_centros_custo_hierarquia.sql` | Hierarquia centros de custo (Bloco B) |
| `011_centros_custo_pai_empresa.sql` | FK composta pai/mesma empresa (correção Bloco B) |
| `012_*` | Departamentos (Bloco C — futuro) |
| `013_*` | Títulos × departamento (Bloco D — futuro) |
| `014_*` | Rateio e vigência (Bloco E — futuro) |
| `015_*` | DRE (Bloco F — futuro) |
| `016_*` | Orçamento (Bloco G — futuro) |

Não renumerar migrations `001`–`011`. Novos blocos usam o próximo número livre.