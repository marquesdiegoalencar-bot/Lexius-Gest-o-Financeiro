-- Popular aprovação pós pré-flight (requer migration 019 aplicada).
-- Não executar correção: use migrations/020_corretiva_vigencia_legado_fuso_exec.sql em seguida.

BEGIN;

TRUNCATE lexius_mig_vigencia_fuso_aprovacao;

INSERT INTO lexius_mig_vigencia_fuso_aprovacao (
  vigencia_id,
  empresa_id_aprovado,
  origem_aprovada,
  fuso_negocio_aprovado,
  valido_de_aprovado,
  valido_ate_aprovado,
  novo_valido_de_aprovado,
  novo_valido_ate_aprovado
)
SELECT
  v.id,
  v.empresa_id,
  v.origem,
  COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus'),
  v.valido_de,
  v.valido_ate,
  (
    ((v.valido_de AT TIME ZONE '-04')::date)::timestamp
    AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus')
  )::timestamptz,
  CASE
    WHEN v.valido_ate IS NULL THEN NULL
    ELSE (
      ((v.valido_ate AT TIME ZONE '-04')::date)::timestamp
      AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus')
    )::timestamptz
  END
FROM lexius_vigencia_elegivel_correcao_fuso el
INNER JOIN titulo_rateio_vigencia v ON v.id = el.vigencia_id
INNER JOIN empresas e ON e.id = v.empresa_id;

COMMIT;