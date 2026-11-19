-- Bloco C: departamentos por empresa.
--
-- Rollback manual SOMENTE se a perda de todos os cadastros for aceita e NÃO existir FK de outras tabelas:
--   DROP TABLE IF EXISTS departamentos;
-- Esse DROP apaga irreversivelmente todos os departamentos. Após o Bloco D (vínculos em títulos etc.),
-- o rollback simples não é aceitável: reverter exige migrations dedicadas que removam dependências
-- antes de alterar a estrutura, sem apagar histórico financeiro inadvertidamente.
-- Não há DELETE físico na API; inativação preserva linhas para consulta histórica.

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