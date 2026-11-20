-- Corretivas D–G: TIMESTAMPTZ vigência [início, fim), SUPERSEDED/APROVADO, fuso empresa, orçamento UNIQUE NULLS NOT DISTINCT.
-- Idempotente onde suportado; executar após 014–016.
--
-- Rollback manual (somente ambientes de teste):
--   Reverter enums/colunas conforme snapshot anterior — não usar em produção com histórico.

BEGIN;

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS fuso_negocio TEXT NOT NULL DEFAULT 'America/Manaus';

DO $$ BEGIN
  ALTER TYPE status_titulo_alocacao ADD VALUE 'SUPERSEDED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE status_orcamento_versao ADD VALUE 'APROVADO';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE status_orcamento_versao ADD VALUE 'SUPERSEDED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_titulo_rateio_vigencia_no_overlap ON titulo_rateio_vigencia;
DROP FUNCTION IF EXISTS trg_titulo_rateio_vigencia_no_overlap();

DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'titulo_rateio_vigencia'
      AND column_name = 'valido_de'
      AND udt_name = 'date'
  ) THEN
    CREATE OR REPLACE FUNCTION lexius_migrar_vigencia_date_para_tstz(d DATE, p_empresa_id UUID)
    RETURNS TIMESTAMPTZ
    LANGUAGE sql
    STABLE
    AS $fn$
      SELECT (
        d::timestamp
        AT TIME ZONE COALESCE(
          NULLIF(TRIM((SELECT fuso_negocio FROM empresas WHERE id = p_empresa_id)), ''),
          'America/Manaus'
        )
      );
    $fn$;

    ALTER TABLE titulo_rateio_vigencia
      ALTER COLUMN valido_de TYPE TIMESTAMPTZ
      USING (lexius_migrar_vigencia_date_para_tstz(valido_de, empresa_id));

    ALTER TABLE titulo_rateio_vigencia
      ALTER COLUMN valido_ate TYPE TIMESTAMPTZ
      USING (
        CASE
          WHEN valido_ate IS NULL THEN NULL
          ELSE lexius_migrar_vigencia_date_para_tstz(valido_ate, empresa_id)
        END
      );

    DROP FUNCTION lexius_migrar_vigencia_date_para_tstz(DATE, UUID);
  END IF;
END $mig$;

ALTER TABLE titulo_rateio_vigencia
  DROP CONSTRAINT IF EXISTS titulo_rateio_vigencia_check1;

ALTER TABLE titulo_rateio_vigencia
  ADD CONSTRAINT titulo_rateio_vigencia_instantes_chk
  CHECK (valido_ate IS NULL OR valido_ate > valido_de);

CREATE OR REPLACE FUNCTION trg_titulo_rateio_vigencia_no_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  conflito INT;
  fim_antigo TIMESTAMPTZ;
  fim_novo TIMESTAMPTZ;
BEGIN
  fim_antigo := COALESCE(NEW.valido_ate, 'infinity'::timestamptz);
  SELECT COUNT(*) INTO conflito
  FROM titulo_rateio_vigencia v
  WHERE v.empresa_id = NEW.empresa_id
    AND v.id IS DISTINCT FROM NEW.id
    AND (
      (NEW.titulo_receber_id IS NOT NULL AND v.titulo_receber_id = NEW.titulo_receber_id)
      OR (NEW.titulo_pagar_id IS NOT NULL AND v.titulo_pagar_id = NEW.titulo_pagar_id)
    )
    AND tstzrange(v.valido_de, COALESCE(v.valido_ate, 'infinity'::timestamptz), '[)')
        && tstzrange(NEW.valido_de, fim_antigo, '[)');

  IF conflito > 0 THEN
    RAISE EXCEPTION 'Vigência de rateio sobrepõe vigência existente para o mesmo título';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_titulo_rateio_vigencia_no_overlap
  BEFORE INSERT OR UPDATE OF valido_de, valido_ate, titulo_receber_id, titulo_pagar_id, empresa_id
  ON titulo_rateio_vigencia
  FOR EACH ROW
  EXECUTE PROCEDURE trg_titulo_rateio_vigencia_no_overlap();

CREATE UNIQUE INDEX IF NOT EXISTS uq_tad_confirmado_tr
  ON titulo_alocacao_definicao (empresa_id, titulo_receber_id)
  WHERE titulo_receber_id IS NOT NULL AND status = 'CONFIRMADO';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tad_confirmado_tp
  ON titulo_alocacao_definicao (empresa_id, titulo_pagar_id)
  WHERE titulo_pagar_id IS NOT NULL AND status = 'CONFIRMADO';

ALTER TABLE orcamento_item DROP CONSTRAINT IF EXISTS orcamento_item_versao_id_categoria_id_centro_custo_id_depart_key;
ALTER TABLE orcamento_item DROP CONSTRAINT IF EXISTS orcamento_item_versao_id_categoria_id_centro_custo_id_departamento_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orc_item_folha
  ON orcamento_item (versao_id, categoria_id, centro_custo_id, departamento_id)
  NULLS NOT DISTINCT;

COMMIT;