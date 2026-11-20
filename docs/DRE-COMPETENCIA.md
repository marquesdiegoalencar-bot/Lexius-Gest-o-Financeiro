# DRE por competência — regras (Bloco F)

## Classificação temporal

- A competência reconhece títulos com `data_competencia` no período filtrado.
- **Fallback histórico:** na ausência de `data_competencia`, usa-se `data_emissao` (sem alterar o registro do título).
- **Pendências:** títulos ativos **sem** `data_competencia` **e** **sem** `data_emissao` válida não entram no demonstrativo principal. A API retorna `avisos.titulos_sem_classificacao_temporal` com quantidade e valor excluído.

## Limitação atual do schema

- `titulos_receber.data_emissao` e `titulos_pagar.data_emissao` são **NOT NULL** (`DEFAULT CURRENT_DATE`). Novos títulos manuais recebem `data_competencia` padrão igual ao vencimento quando omitida.
- Na prática, a pendência “sem classificação temporal” só aparece em cenários de dados legados importados ou ajustes controlados no banco — não em fluxo normal da API.

## Vigência de rateio na competência

- A vigência aplicada usa instante **TIMESTAMPTZ** no fuso da empresa (`empresas.fuso_negocio`, padrão `America/Manaus`), com intervalo **`[valido_de, valido_ate)`** (`valido_ate` exclusivo).

## DRE por caixa

- Agrega `baixa_alocacao_item` de baixas **não estornadas**, filtrando por `data_baixa` no período (efetivo, respeitando estornos).