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
| `013_titulos_dimensoes_empresa.sql` | `departamento_id` / CC em títulos e recorrências; FKs compostas (Bloco D.1) |
| `014_rateio_vigencia.sql` | Rateio, vigências, `baixa_alocacao_item`, `recorrencia_id` em títulos a receber (Bloco E) |
| `015_dre_indices.sql` | Índices competência/caixa para DRE (Bloco F) |
| `016_orcamento.sql` | `orcamento_versao` / `orcamento_item` (Bloco G) |
| `017_corretivas_dg_vigencia_estados.sql` | TIMESTAMPTZ vigência `[)` **por `empresas.fuso_negocio`**, enums, índices |
| `018_corretiva_vigencia_fuso_por_empresa.sql` | **Deprecado** — no-op na cadeia; não usar em produção (ver `docs/OPERACAO-MIGRACAO-VIGENCIA-FUSO.md`) |
| `019_vigencia_fuso_aprovacao_estrutura.sql` | Tabela/view de aprovação (etapa preparatória; **sem** UPDATE em vigências) |
| `019a_vigencia_fuso_aprovacao_trilha.sql` | **Incremental:** `correcao_aplicada_em`, `lote_execucao` + backfill conservador (bancos com 019≠b5dcbdb+trilha) |
| `020_corretiva_vigencia_legado_fuso_exec.sql` | Execução corretiva **publicada (b5dcbdb)** — **congelada**; não alterar conteúdo |
| `021_corretiva_vigencia_legado_fuso_idempotente.sql` | Execução idempotente + trilha; usar **operacionalmente** após populate |

Não renumerar migrations `001`–`011`. Novos blocos usam o próximo número livre.

### `017_corretivas_dg_vigencia_estados.sql` — aplicar / reverter

**Aplicar** (banco com 014–016):

```bash
psql "$DATABASE_URL" -f migrations/017_corretivas_dg_vigencia_estados.sql
```

Converte vigências DATE → TIMESTAMPTZ usando **início do dia civil no `fuso_negocio` de cada linha** (`JOIN` via `empresa_id`; fallback `America/Manaus`), atualiza trigger, índices.

### `018_corretiva_vigencia_fuso_por_empresa.sql`

**Não aplicar em produção** como correção ativa: o arquivo atual é **no-op** (compatibilidade de numeração). A versão histórica com UPDATE cego por assinatura `-04` foi substituída pela **019** + pré-flight.

### `019_vigencia_fuso_aprovacao_estrutura.sql` — aplicar (preparatório)

Cria `lexius_mig_vigencia_fuso_aprovacao` e `lexius_vigencia_elegivel_correcao_fuso`. **Não** altera vigências. Em banco incremental: aplicar **antes** de popular aprovação.

### `019a_vigencia_fuso_aprovacao_trilha.sql` — aplicar (incremental)

**Obrigatória** antes da **021** operacional:

- Bancos que aplicaram **`019` publicada (ex.: b5dcbdb)** sem `correcao_aplicada_em`.
- Bancos novos via `reset-db`: aplicada automaticamente **entre** 019 e 020.

Não modifica vigências. Backfill: marca linhas já corrigidas (vigência = destino aprovado, fora da view elegível).

### `020_corretiva_vigencia_legado_fuso_exec.sql` — artefato publicado (não reexecutar em upgrade)

Versão fixa em **b5dcbdb**. **Não** há registro de “já executada” no banco; em ambientes que rodaram esse SQL manualmente, **não** reaplique o arquivo ao atualizar o repositório — use **019a** + **021**.

### `021_corretiva_vigencia_legado_fuso_idempotente.sql` — correção operacional

Somente após **019**, **019a**, **pré-flight** e `populate-aprovacao-vigencia-fuso.sql`:

```bash
psql "$DATABASE_URL" -f migrations/021_corretiva_vigencia_legado_fuso_idempotente.sql
```

Pode ser executada quantas vezes forem necessárias (idempotência por `correcao_aplicada_em`). Guia: `docs/OPERACAO-MIGRACAO-VIGENCIA-FUSO.md`.

### Migrations SQL vs TypeORM

Migrations numeradas em `migrations/*.sql` são aplicadas por `scripts/migrate.js` e `scripts/reset-db.js` (ordem lexicográfica, **transação por arquivo**). O `TypeOrmModule` **não** registra `migrations` nem `migrationsTransactionMode`; runtime Nest usa `synchronize` apenas quando `DB_SYNC_SCHEMA=true` (e2e usa schema.sql + SQL incremental).

### `012_departamentos.sql` — aplicar / reverter

**Aplicar** (banco existente, somente incremental):

```bash
psql "$DATABASE_URL" -f migrations/012_departamentos.sql
```

**Reverter** — leia antes de executar em qualquer ambiente com dados:

- `DROP TABLE IF EXISTS departamentos` **elimina todos os departamentos** cadastrados, de forma irreversível sem backup.
- Só é aceitável quando a perda integral dos dados for expressamente aceita **e** não houver dependências (FKs de outras tabelas apontando para `departamentos`).
- **Até o Bloco D:** em geral não há vínculos em títulos; mesmo assim, evite `DROP` em staging/produção com cadastros em uso — prefira backup ou migração de dados.
- **A partir do Bloco D** (ex.: `departamento_id` em títulos): o rollback simples **não poderá** ser usado. Reversões devem passar por migrations próprias que tratem dependências (remover ou realocar FKs, preservar histórico) **antes** de alterar ou remover a tabela. Não use `DROP` para “desfazer” o bloco com histórico financeiro ativo.

```sql
-- Somente ambiente vazio / perda aceita / sem FKs dependentes:
DROP TABLE IF EXISTS departamentos;
```

E2E e `scripts/reset-db.js` recriam o schema completo (`schema.sql` + migrations em ordem lexicográfica) e **não** dependem deste `DROP` manual.

### `014_rateio_vigencia.sql` — aplicar / reverter

**Aplicar** (banco existente com 001–013):

```bash
psql "$DATABASE_URL" -f migrations/014_rateio_vigencia.sql
```

Executa backfill **LEGADO** (vigência 100% com centro/departamento do título). Rollback: comentário no topo do arquivo.

### `015_dre_indices.sql` — aplicar / reverter

```bash
psql "$DATABASE_URL" -f migrations/015_dre_indices.sql
```

Somente índices; rollback = `DROP INDEX` listados no arquivo.

### `016_orcamento.sql` — aplicar / reverter

```bash
psql "$DATABASE_URL" -f migrations/016_orcamento.sql
```

Rollback destrói versões e itens de orçamento — ver comentário no arquivo.

### `013_titulos_dimensoes_empresa.sql` — aplicar / reverter

**Aplicar** (banco existente com 001–012 já aplicados):

```bash
psql "$DATABASE_URL" -f migrations/013_titulos_dimensoes_empresa.sql
```

A migration é **transacional** e executa **pré-checks** em `centro_custo_id` dos títulos (órfãos ou empresa divergente). Se falhar, **não altera** a estrutura — corrija os dados e reaplique.

**Reverter** (remove colunas e FKs; **não** apaga `departamentos` nem dados históricos em títulos além das colunas novas):

Ver comentário de rollback no topo de `migrations/013_titulos_dimensoes_empresa.sql`. Após D.1+, o `DROP TABLE departamentos` da doc 012 permanece **proibido** em ambientes com histórico.

## Concorrência — ordem de bloqueio (centros de custo)

Operações concorrentes no **mesmo `id` de centro** (ou no **pai** ao criar filho) serializam com `pessimistic_write` na linha alvo:

| Operação | Linha bloqueada |
|----------|-----------------|
| Novo vínculo financeiro (título) | Centro analítico vinculado |
| Inativar / reativar / mudar `pai_id` | O próprio centro; ao mudar pai, também o novo pai |
| Criar filho na hierarquia | Pai (`pai_id`) |

Não há ordenação multi-linha obrigatória além de **pai antes do insert do filho** e **self-lock em updates**. Duas sessões que disputam o mesmo pai ou o mesmo centro aguardam na fila do PostgreSQL; deadlocks entre estas rotas não foram observados nos testes determinísticos (`test/centros-custo-concorrencia-deterministica.e2e-spec.ts`).