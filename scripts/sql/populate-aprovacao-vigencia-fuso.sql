-- Popular aprovação pós pré-flight (requer 019 + 019a).
-- Preserva linhas com correcao_aplicada_em (trilha de auditoria).
-- Remove somente lote PENDENTE antes de novo populate.
-- Execução operacional da correção: migrations/021_corretiva_vigencia_legado_fuso_idempotente.sql

BEGIN;

DO $pop$
DECLARE
  bad_elegivel UUID[];
  dup_pendente UUID[];
  contra_concluida UUID[];
BEGIN
  IF to_regclass('public.lexius_mig_vigencia_fuso_aprovacao') IS NULL THEN
    RAISE EXCEPTION 'Populate: tabela lexius_mig_vigencia_fuso_aprovacao inexistente. Aplique migration 019.';
  END IF;

  IF to_regclass('public.lexius_vigencia_elegivel_correcao_fuso') IS NULL THEN
    RAISE EXCEPTION 'Populate: view lexius_vigencia_elegivel_correcao_fuso inexistente. Aplique migration 019.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lexius_mig_vigencia_fuso_aprovacao'
      AND column_name = 'correcao_aplicada_em'
  ) THEN
    RAISE EXCEPTION 'Populate: aplique migrations/019a_vigencia_fuso_aprovacao_trilha.sql antes.';
  END IF;

  SELECT COALESCE(array_agg(el.vigencia_id ORDER BY el.vigencia_id), ARRAY[]::uuid[])
  INTO bad_elegivel
  FROM lexius_vigencia_elegivel_correcao_fuso el
  LEFT JOIN titulo_rateio_vigencia v ON v.id = el.vigencia_id
  LEFT JOIN empresas e ON e.id = v.empresa_id
  WHERE v.id IS NULL
     OR v.empresa_id IS NULL
     OR v.origem IS NULL
     OR v.valido_de IS NULL
     OR e.id IS NULL
     OR (
       (
         ((v.valido_de AT TIME ZONE '-04')::date)::timestamp
         AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus')
       )::timestamptz IS NULL
     );

  IF COALESCE(array_length(bad_elegivel, 1), 0) > 0 THEN
    RAISE EXCEPTION
      'Populate: elegível com dados incompletos (empresa, origem, fuso ou destino). IDs: %',
      bad_elegivel;
  END IF;

  SELECT COALESCE(array_agg(a.vigencia_id ORDER BY a.vigencia_id), ARRAY[]::uuid[])
  INTO dup_pendente
  FROM lexius_mig_vigencia_fuso_aprovacao a
  WHERE a.correcao_aplicada_em IS NULL
    AND (
      a.empresa_id_aprovado IS NULL
     OR a.origem_aprovada IS NULL
     OR a.fuso_negocio_aprovado IS NULL
     OR a.valido_de_aprovado IS NULL
     OR a.novo_valido_de_aprovado IS NULL
    );

  IF COALESCE(array_length(dup_pendente, 1), 0) > 0 THEN
    RAISE EXCEPTION
      'Populate: aprovação pendente com snapshot incompleto. Corrija ou remova antes do populate. IDs: %',
      dup_pendente;
  END IF;

  SELECT COALESCE(array_agg(el.vigencia_id ORDER BY el.vigencia_id), ARRAY[]::uuid[])
  INTO contra_concluida
  FROM lexius_vigencia_elegivel_correcao_fuso el
  WHERE EXISTS (
    SELECT 1
    FROM lexius_mig_vigencia_fuso_aprovacao a
    WHERE a.vigencia_id = el.vigencia_id
      AND a.correcao_aplicada_em IS NOT NULL
  );

  IF COALESCE(array_length(contra_concluida, 1), 0) > 0 THEN
    RAISE EXCEPTION
      'Populate: vigência elegível já possui aprovação concluída (não reaproveitar). IDs: %',
      contra_concluida;
  END IF;
END;
$pop$;

DELETE FROM lexius_mig_vigencia_fuso_aprovacao
WHERE correcao_aplicada_em IS NULL;

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
INNER JOIN empresas e ON e.id = v.empresa_id
WHERE NOT EXISTS (
  SELECT 1
  FROM lexius_mig_vigencia_fuso_aprovacao a
  WHERE a.vigencia_id = v.id
    AND a.correcao_aplicada_em IS NOT NULL
);

COMMIT;