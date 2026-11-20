-- Etapa preparatória: tabela de aprovação + view de elegibilidade.
-- Não executa correção. Popular aprovação após pré-flight, depois aplicar 020.
-- Pré-flight: scripts/sql/preflight-vigencia-fuso-017-legacy.sql
-- Popular: scripts/sql/populate-aprovacao-vigencia-fuso.sql
-- Operação: docs/OPERACAO-MIGRACAO-VIGENCIA-FUSO.md

BEGIN;

CREATE TABLE IF NOT EXISTS lexius_mig_vigencia_fuso_aprovacao (
  vigencia_id UUID PRIMARY KEY REFERENCES titulo_rateio_vigencia(id) ON DELETE CASCADE,
  aprovado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lexius_mig_vigencia_fuso_aprovacao
  ADD COLUMN IF NOT EXISTS empresa_id_aprovado UUID,
  ADD COLUMN IF NOT EXISTS origem_aprovada origem_titulo_rateio_vigencia,
  ADD COLUMN IF NOT EXISTS fuso_negocio_aprovado TEXT,
  ADD COLUMN IF NOT EXISTS valido_de_aprovado TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valido_ate_aprovado TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS novo_valido_de_aprovado TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS novo_valido_ate_aprovado TIMESTAMPTZ;

ALTER TABLE lexius_mig_vigencia_fuso_aprovacao
  DROP CONSTRAINT IF EXISTS lexius_mig_vigencia_fuso_aprovacao_empresa_fk;

ALTER TABLE lexius_mig_vigencia_fuso_aprovacao
  ADD CONSTRAINT lexius_mig_vigencia_fuso_aprovacao_empresa_fk
  FOREIGN KEY (empresa_id_aprovado) REFERENCES empresas(id);

CREATE OR REPLACE VIEW lexius_vigencia_elegivel_correcao_fuso AS
SELECT
  v.id AS vigencia_id
FROM titulo_rateio_vigencia v
INNER JOIN empresas e ON e.id = v.empresa_id
WHERE v.origem = 'LEGADO'
  AND COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus') <> 'America/Manaus'
  AND (
    (
      v.valido_de = (
        ((v.valido_de AT TIME ZONE '-04')::date::text) || ' 00:00:00-04'
      )::timestamptz
      AND v.valido_de IS DISTINCT FROM (
        ((v.valido_de AT TIME ZONE '-04')::date)::timestamp
        AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus')
      )::timestamptz
    )
    OR (
      v.valido_ate IS NOT NULL
      AND v.valido_ate = (
        ((v.valido_ate AT TIME ZONE '-04')::date::text) || ' 00:00:00-04'
      )::timestamptz
      AND v.valido_ate IS DISTINCT FROM (
        ((v.valido_ate AT TIME ZONE '-04')::date)::timestamp
        AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus')
      )::timestamptz
    )
  );

COMMENT ON TABLE lexius_mig_vigencia_fuso_aprovacao IS
  'Snapshot de aprovação humana pós pré-flight. Obrigatório antes da migration 020.';

COMMIT;