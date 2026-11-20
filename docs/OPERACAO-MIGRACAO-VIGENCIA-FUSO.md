# Operação — correção de vigência TIMESTAMPTZ (fuso por empresa)

## Quando usar cada artefato

| Artefato | Uso |
|----------|-----|
| **017** | Conversão DATE→TIMESTAMPTZ por `fuso_negocio` (colunas ainda `DATE`). |
| **018** (atual) | **No-op** na cadeia — não usar como correção. |
| **Pré-flight** | `scripts/sql/preflight-vigencia-fuso-017-legacy.sql` — **somente leitura**. |
| **019** | `019_vigencia_fuso_aprovacao_estrutura.sql` — cria tabela + view (**sem UPDATE**). |
| **Popular aprovação** | `scripts/sql/populate-aprovacao-vigencia-fuso.sql` — após revisão humana. |
| **020** | `020_corretiva_vigencia_legado_fuso_exec.sql` — correção restrita. |

**Publicação depende de validação humana** dos registros do pré-flight.

## Arquitetura de publicação (ordem obrigatória)

```text
017 (se DATE legado) → 018 no-op (cadeia) → 019 estrutura → pré-flight (leitura)
  → revisão humana → populate-aprovacao → 020 execução → verificação pós
```

Não é possível popular aprovações **antes** da **019**: a tabela e a view só existem após esse arquivo.

Cada arquivo `.sql` roda em **uma transação** (`BEGIN`/`COMMIT` no próprio arquivo) via `psql -f` ou `scripts/migrate.js`.

## Snapshots obrigatórios na aprovação

Cada linha em `lexius_mig_vigencia_fuso_aprovacao` deve conter:

| Campo | Finalidade |
|-------|------------|
| `vigencia_id` | Chave aprovada |
| `empresa_id_aprovado` | Empresa no momento do pré-flight |
| `origem_aprovada` | Deve ser `LEGADO` para elegíveis |
| `fuso_negocio_aprovado` | Fuso efetivo da empresa |
| `valido_de_aprovado` / `valido_ate_aprovado` | Instantes **antes** da correção |
| `novo_valido_de_aprovado` / `novo_valido_ate_aprovado` | Destinos calculados (pré-flight) |

A **020** aborta se qualquer um divergir do estado atual ou se o recálculo dos destinos não bater com `novo_*_aprovado`.

## 1. Pré-flight

```bash
psql "$DATABASE_URL" -f scripts/sql/preflight-vigencia-fuso-017-legacy.sql > preflight-vigencia-$(date +%Y%m%d).txt
```

## 2. Aplicar estrutura (019)

```bash
psql "$DATABASE_URL" -f migrations/019_vigencia_fuso_aprovacao_estrutura.sql
```

## 3. Revisar e aprovar

```sql
SELECT vigencia_id FROM lexius_vigencia_elegivel_correcao_fuso;
```

## 4. Popular aprovação (snapshots completos)

```bash
psql "$DATABASE_URL" -f scripts/sql/populate-aprovacao-vigencia-fuso.sql
```

## 5. Executar correção (020)

```bash
psql "$DATABASE_URL" -f migrations/020_corretiva_vigencia_legado_fuso_exec.sql
```

## 6. Verificação

- Reexecutar pré-flight; candidatos classe A devem desaparecer ou estar alinhados.
- DRE de amostra; `baixa_alocacao_item` e IDs de vigência inalterados.

## Divergências

| Mensagem | Ação |
|----------|------|
| `Divergência entre elegíveis e aprovados` | Ajustar conjunto de IDs (parcial ou extra). |
| `Aprovação incompleta` | Repopular com script de snapshots. |
| `snapshot aprovado e vigência/empresa atual` | Dado mudou após aprovação — novo pré-flight. |
| `Aprovações órfãs` | Elegíveis zerados mas tabela de aprovação não vazia — `TRUNCATE` e repopular. |
| `inexistente` (tabela/view) | Aplicar **019** antes da **020**. |