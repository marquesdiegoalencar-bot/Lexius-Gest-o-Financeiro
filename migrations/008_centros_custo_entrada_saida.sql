DO $$ BEGIN
  CREATE TYPE tipo_centro_custo AS ENUM ('ENTRADA', 'SAIDA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE centros_custo ADD COLUMN IF NOT EXISTS codigo VARCHAR(32);
ALTER TABLE centros_custo ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE centros_custo ADD COLUMN IF NOT EXISTS tipo tipo_centro_custo NOT NULL DEFAULT 'ENTRADA';

CREATE UNIQUE INDEX IF NOT EXISTS uq_centros_custo_empresa_codigo
  ON centros_custo (empresa_id, codigo)
  WHERE codigo IS NOT NULL;