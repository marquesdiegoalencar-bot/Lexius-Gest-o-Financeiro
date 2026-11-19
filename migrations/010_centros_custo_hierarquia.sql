-- Bloco B: hierarquia de centros de custo (pai_id, tipo_no).
-- Rollback (manual, após backup):
--   ALTER TABLE centros_custo DROP COLUMN IF EXISTS pai_id;
--   ALTER TABLE centros_custo DROP COLUMN IF EXISTS tipo_no;
--   DROP TYPE IF EXISTS tipo_no_centro_custo;
-- Limitação: rollback remove classificação hierárquica; registros e vínculos financeiros permanecem.

DO $$ BEGIN
  CREATE TYPE tipo_no_centro_custo AS ENUM ('GRUPO', 'SUBGRUPO', 'ANALITICO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE centros_custo ADD COLUMN IF NOT EXISTS pai_id UUID REFERENCES centros_custo(id);
ALTER TABLE centros_custo ADD COLUMN IF NOT EXISTS tipo_no tipo_no_centro_custo;

UPDATE centros_custo SET tipo_no = 'ANALITICO' WHERE tipo_no IS NULL;

ALTER TABLE centros_custo ALTER COLUMN tipo_no SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_centros_custo_pai_id ON centros_custo (pai_id);