-- Bloco C: departamentos por empresa.
-- Rollback manual (após backup):
--   DROP TABLE IF EXISTS departamentos;
-- Registros permanecem em histórico futuro via vínculos (Bloco D); não há DELETE físico na API.

CREATE TABLE IF NOT EXISTS departamentos (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id     UUID NOT NULL REFERENCES empresas(id),
    codigo         VARCHAR(32),
    nome           TEXT NOT NULL,
    descricao      TEXT,
    ativo          BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_departamentos_empresa_codigo
  ON departamentos (empresa_id, codigo)
  WHERE codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_departamentos_empresa_ativo
  ON departamentos (empresa_id, ativo);