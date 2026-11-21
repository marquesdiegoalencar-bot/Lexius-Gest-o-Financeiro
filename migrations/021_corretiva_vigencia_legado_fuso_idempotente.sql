-- Execução idempotente pós 019a: mesma correção da 020 publicada + trilha correcao_aplicada_em.
-- Aplicar manualmente após populate (não depende de registro de execução — ver docs/OPERACAO-MIGRACAO-VIGENCIA-FUSO.md).
-- Bancos com 020 antiga já aplicada: aplicar só 019a + este arquivo (não reexecutar 020 publicada).

BEGIN;

DO $cor$
DECLARE
  elegiveis UUID[];
  aprovados UUID[];
  somente_elegivel UUID[];
  somente_aprovado UUID[];
  qt_atualizados_de INT := 0;
  qt_atualizados_ate INT := 0;
  lote UUID := gen_random_uuid();
  pendentes INT := 0;
  concluidos INT := 0;
BEGIN
  IF to_regclass('public.lexius_mig_vigencia_fuso_aprovacao') IS NULL THEN
    RAISE EXCEPTION
      'Tabela lexius_mig_vigencia_fuso_aprovacao inexistente. Aplique migrations/019_vigencia_fuso_aprovacao_estrutura.sql antes.';
  END IF;

  IF to_regclass('public.lexius_vigencia_elegivel_correcao_fuso') IS NULL THEN
    RAISE EXCEPTION
      'View lexius_vigencia_elegivel_correcao_fuso inexistente. Aplique a migration 019 antes.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lexius_mig_vigencia_fuso_aprovacao'
      AND column_name = 'correcao_aplicada_em'
  ) THEN
    RAISE EXCEPTION
      'Coluna correcao_aplicada_em ausente. Aplique migrations/019a_vigencia_fuso_aprovacao_trilha.sql antes da 021.';
  END IF;

  SELECT COALESCE(array_agg(vigencia_id ORDER BY vigencia_id), ARRAY[]::uuid[])
  INTO elegiveis
  FROM lexius_vigencia_elegivel_correcao_fuso;

  SELECT COALESCE(array_agg(vigencia_id ORDER BY vigencia_id), ARRAY[]::uuid[])
  INTO aprovados
  FROM lexius_mig_vigencia_fuso_aprovacao
  WHERE correcao_aplicada_em IS NULL;

  SELECT COUNT(*)::int INTO pendentes
  FROM lexius_mig_vigencia_fuso_aprovacao
  WHERE correcao_aplicada_em IS NULL;

  SELECT COUNT(*)::int INTO concluidos
  FROM lexius_mig_vigencia_fuso_aprovacao
  WHERE correcao_aplicada_em IS NOT NULL;

  IF COALESCE(array_length(elegiveis, 1), 0) = 0 THEN
    IF pendentes > 0 THEN
      RAISE EXCEPTION
        'Aprovações pendentes sem vigências elegíveis (órfãs). Revise pré-flight/populate. Pendente: %',
        aprovados;
    END IF;
    IF concluidos > 0 THEN
      RAISE NOTICE 'Migration 021: operação já concluída (% aprovações com correção aplicada); idempotente.',
        concluidos;
    ELSE
      RAISE NOTICE 'Migration 021: nenhuma vigência elegível; nada a corrigir.';
    END IF;
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(x ORDER BY x), ARRAY[]::uuid[])
  INTO somente_elegivel
  FROM unnest(elegiveis) AS x
  WHERE NOT (x = ANY(aprovados));

  SELECT COALESCE(array_agg(x ORDER BY x), ARRAY[]::uuid[])
  INTO somente_aprovado
  FROM unnest(aprovados) AS x
  WHERE NOT (x = ANY(elegiveis));

  IF COALESCE(array_length(somente_elegivel, 1), 0) > 0
     OR COALESCE(array_length(somente_aprovado, 1), 0) > 0 THEN
    RAISE EXCEPTION
      'Divergência entre elegíveis e aprovados. Somente elegíveis: %; somente aprovados: %',
      somente_elegivel,
      somente_aprovado;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM lexius_mig_vigencia_fuso_aprovacao
    WHERE correcao_aplicada_em IS NULL
      AND (
        empresa_id_aprovado IS NULL
       OR origem_aprovada IS NULL
       OR fuso_negocio_aprovado IS NULL
       OR valido_de_aprovado IS NULL
       OR novo_valido_de_aprovado IS NULL
      )
  ) THEN
    RAISE EXCEPTION
      'Aprovação incompleta: snapshots obrigatórios (empresa, origem, fuso, valido_de, novo_valido_de).';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM lexius_mig_vigencia_fuso_aprovacao a
    INNER JOIN titulo_rateio_vigencia v ON v.id = a.vigencia_id
    INNER JOIN empresas e ON e.id = v.empresa_id
    WHERE a.correcao_aplicada_em IS NULL
      AND (
        v.empresa_id IS DISTINCT FROM a.empresa_id_aprovado
       OR v.origem IS DISTINCT FROM a.origem_aprovada
       OR COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus')
          IS DISTINCT FROM a.fuso_negocio_aprovado
       OR v.valido_de IS DISTINCT FROM a.valido_de_aprovado
       OR v.valido_ate IS DISTINCT FROM a.valido_ate_aprovado
      )
  ) THEN
    RAISE EXCEPTION
      'Divergência entre snapshot aprovado e vigência/empresa atual. IDs: %',
      (
        SELECT COALESCE(array_agg(a.vigencia_id ORDER BY a.vigencia_id), ARRAY[]::uuid[])
        FROM lexius_mig_vigencia_fuso_aprovacao a
        INNER JOIN titulo_rateio_vigencia v ON v.id = a.vigencia_id
        INNER JOIN empresas e ON e.id = v.empresa_id
        WHERE a.correcao_aplicada_em IS NULL
          AND (
            v.empresa_id IS DISTINCT FROM a.empresa_id_aprovado
           OR v.origem IS DISTINCT FROM a.origem_aprovada
           OR COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus')
              IS DISTINCT FROM a.fuso_negocio_aprovado
           OR v.valido_de IS DISTINCT FROM a.valido_de_aprovado
           OR v.valido_ate IS DISTINCT FROM a.valido_ate_aprovado
          )
      );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM lexius_mig_vigencia_fuso_aprovacao a
    INNER JOIN titulo_rateio_vigencia v ON v.id = a.vigencia_id
    INNER JOIN empresas e ON e.id = v.empresa_id
    WHERE a.correcao_aplicada_em IS NULL
      AND a.novo_valido_de_aprovado IS DISTINCT FROM (
      ((v.valido_de AT TIME ZONE '-04')::date)::timestamp
      AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus')
    )::timestamptz
       OR (
         (v.valido_ate IS NULL AND a.novo_valido_ate_aprovado IS NOT NULL)
         OR (v.valido_ate IS NOT NULL AND a.novo_valido_ate_aprovado IS DISTINCT FROM (
           ((v.valido_ate AT TIME ZONE '-04')::date)::timestamp
           AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus')
         )::timestamptz)
       )
  ) THEN
    RAISE EXCEPTION
      'Destinos aprovados divergentes do recálculo atual (pré-flight desatualizado). IDs: %',
      (
        SELECT COALESCE(array_agg(a.vigencia_id ORDER BY a.vigencia_id), ARRAY[]::uuid[])
        FROM lexius_mig_vigencia_fuso_aprovacao a
        INNER JOIN titulo_rateio_vigencia v ON v.id = a.vigencia_id
        INNER JOIN empresas e ON e.id = v.empresa_id
        WHERE a.correcao_aplicada_em IS NULL
          AND a.novo_valido_de_aprovado IS DISTINCT FROM (
          ((v.valido_de AT TIME ZONE '-04')::date)::timestamp
          AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus')
        )::timestamptz
           OR (
             (v.valido_ate IS NULL AND a.novo_valido_ate_aprovado IS NOT NULL)
             OR (v.valido_ate IS NOT NULL AND a.novo_valido_ate_aprovado IS DISTINCT FROM (
               ((v.valido_ate AT TIME ZONE '-04')::date)::timestamp
               AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus')
             )::timestamptz)
           )
      );
  END IF;

  WITH upd AS (
    UPDATE titulo_rateio_vigencia v
    SET valido_de = a.novo_valido_de_aprovado
    FROM lexius_mig_vigencia_fuso_aprovacao a
    WHERE a.vigencia_id = v.id
      AND a.correcao_aplicada_em IS NULL
      AND v.origem = 'LEGADO'
      AND v.id = ANY(elegiveis)
      AND v.valido_de = (
        ((v.valido_de AT TIME ZONE '-04')::date::text) || ' 00:00:00-04'
      )::timestamptz
      AND v.valido_de IS DISTINCT FROM a.novo_valido_de_aprovado
    RETURNING v.id
  )
  SELECT COUNT(*)::int INTO qt_atualizados_de FROM upd;

  WITH upd AS (
    UPDATE titulo_rateio_vigencia v
    SET valido_ate = a.novo_valido_ate_aprovado
    FROM lexius_mig_vigencia_fuso_aprovacao a
    WHERE a.vigencia_id = v.id
      AND a.correcao_aplicada_em IS NULL
      AND v.origem = 'LEGADO'
      AND v.id = ANY(elegiveis)
      AND v.valido_ate IS NOT NULL
      AND v.valido_ate = (
        ((v.valido_ate AT TIME ZONE '-04')::date::text) || ' 00:00:00-04'
      )::timestamptz
      AND a.novo_valido_ate_aprovado IS NOT NULL
      AND v.valido_ate IS DISTINCT FROM a.novo_valido_ate_aprovado
    RETURNING v.id
  )
  SELECT COUNT(*)::int INTO qt_atualizados_ate FROM upd;

  UPDATE lexius_mig_vigencia_fuso_aprovacao
  SET correcao_aplicada_em = now(),
      lote_execucao = lote
  WHERE vigencia_id = ANY(elegiveis)
    AND correcao_aplicada_em IS NULL;

  RAISE NOTICE 'Migration 021: elegíveis=%, aprovados pendentes=%, atualizados valido_de=%, valido_ate=%, lote=%',
    COALESCE(array_length(elegiveis, 1), 0),
    COALESCE(array_length(aprovados, 1), 0),
    qt_atualizados_de,
    qt_atualizados_ate,
    lote;
END;
$cor$;

COMMIT;