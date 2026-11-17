DO $$ BEGIN
  CREATE TYPE modalidade_cobranca AS ENUM ('COBRANCA_V3', 'PIX_COBV');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE contas_bancarias
  ADD COLUMN IF NOT EXISTS chave_pix TEXT,
  ADD COLUMN IF NOT EXISTS tipo_chave_pix TEXT;

ALTER TABLE cobrancas_boleto
  ADD COLUMN IF NOT EXISTS modalidade modalidade_cobranca NOT NULL DEFAULT 'COBRANCA_V3';

CREATE INDEX IF NOT EXISTS idx_cobrancas_modalidade_status
  ON cobrancas_boleto (modalidade, status);