-- Incremental (pós 019 publicada em b5dcbdb): colunas de trilha/idempotência da 020.
-- Não altera titulo_rateio_vigencia. Seguro reexecutar (IF NOT EXISTS).
-- Aplicar em bancos que já rodaram 019 sem correcao_aplicada_em, antes da 021 operacional.
-- Na cadeia e2e/reset-db: roda entre 019 e 020 (ordem lexicográfica).

BEGIN;

ALTER TABLE lexius_mig_vigencia_fuso_aprovacao
  ADD COLUMN IF NOT EXISTS correcao_aplicada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lote_execucao UUID;

COMMENT ON COLUMN lexius_mig_vigencia_fuso_aprovacao.correcao_aplicada_em IS
  'Preenchido pela 021 ao concluir correção; preserva trilha sem apagar linhas.';
COMMENT ON COLUMN lexius_mig_vigencia_fuso_aprovacao.lote_execucao IS
  'UUID do lote da execução 021 que marcou a linha.';

-- Backfill conservador: vigência já alinhada ao destino aprovado e fora da elegibilidade atual.
UPDATE lexius_mig_vigencia_fuso_aprovacao a
SET
  correcao_aplicada_em = COALESCE(a.aprovado_em, now()),
  lote_execucao = COALESCE(a.lote_execucao, gen_random_uuid())
WHERE a.correcao_aplicada_em IS NULL
  AND a.empresa_id_aprovado IS NOT NULL
  AND a.novo_valido_de_aprovado IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM lexius_vigencia_elegivel_correcao_fuso e WHERE e.vigencia_id = a.vigencia_id
  )
  AND EXISTS (
    SELECT 1
    FROM titulo_rateio_vigencia v
    WHERE v.id = a.vigencia_id
      AND v.valido_de IS NOT DISTINCT FROM a.novo_valido_de_aprovado
      AND (v.valido_ate IS NOT DISTINCT FROM a.novo_valido_ate_aprovado)
  );

COMMIT;