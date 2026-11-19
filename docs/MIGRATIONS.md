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
| `012_departamentos.sql` | Tabela `departamentos` por empresa (Bloco C) |
| `013_*` | Títulos × departamento (Bloco D — futuro) |
| `014_*` | Rateio e vigência (Bloco E — futuro) |
| `015_*` | DRE (Bloco F — futuro) |
| `016_*` | Orçamento (Bloco G — futuro) |

Não renumerar migrations `001`–`011`. Novos blocos usam o próximo número livre.

### `012_departamentos.sql` — aplicar / reverter

**Aplicar** (banco existente, somente incremental):

```bash
psql "$DATABASE_URL" -f migrations/012_departamentos.sql
```

**Reverter** (remove somente a tabela; não há vínculos em títulos até o Bloco D):

```sql
DROP TABLE IF EXISTS departamentos;
```

E2E e `scripts/reset-db.js` já incluem `schema.sql` + migrations em ordem lexicográfica.

## Concorrência — ordem de bloqueio (centros de custo)

Operações concorrentes no **mesmo `id` de centro** (ou no **pai** ao criar filho) serializam com `pessimistic_write` na linha alvo:

| Operação | Linha bloqueada |
|----------|-----------------|
| Novo vínculo financeiro (título) | Centro analítico vinculado |
| Inativar / reativar / mudar `pai_id` | O próprio centro; ao mudar pai, também o novo pai |
| Criar filho na hierarquia | Pai (`pai_id`) |

Não há ordenação multi-linha obrigatória além de **pai antes do insert do filho** e **self-lock em updates**. Duas sessões que disputam o mesmo pai ou o mesmo centro aguardam na fila do PostgreSQL; deadlocks entre estas rotas não foram observados nos testes determinísticos (`test/centros-custo-concorrencia-deterministica.e2e-spec.ts`).