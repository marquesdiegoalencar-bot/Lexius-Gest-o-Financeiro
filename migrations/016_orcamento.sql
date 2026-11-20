-- Bloco G: orçamento por versão mensal e itens folha.
-- Transação atômica.
--
-- Rollback manual (apaga versões e previstos):
--   DROP TABLE IF EXISTS orcamento_item;
--   DROP TABLE IF EXISTS orcamento_versao;
--   DROP TYPE IF EXISTS status_orcamento_versao;

BEGIN;

DO $$ BEGIN
  CREATE TYPE status_orcamento_versao AS ENUM ('RASCUNHO', 'FECHADO', 'CANCELADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS orcamento_versao (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL REFERENCES empresas(id),
    ano             SMALLINT NOT NULL CHECK (ano >= 2000 AND ano <= 2100),
    mes             SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    nome            TEXT,
    status          status_orcamento_versao NOT NULL DEFAULT 'RASCUNHO',
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, ano, mes, nome)
);

CREATE INDEX IF NOT EXISTS idx_orc_versao_empresa_periodo
  ON orcamento_versao (empresa_id, ano, mes, status);

CREATE TABLE IF NOT EXISTS orcamento_item (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    versao_id         UUID NOT NULL REFERENCES orcamento_versao(id) ON DELETE CASCADE,
    empresa_id        UUID NOT NULL REFERENCES empresas(id),
    categoria_id      UUID NOT NULL REFERENCES categorias(id),
    centro_custo_id   UUID,
    departamento_id   UUID,
    valor_previsto    NUMERIC(14,2) NOT NULL CHECK (valor_previsto >= 0),
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (empresa_id, centro_custo_id) REFERENCES centros_custo (empresa_id, id),
  FOREIGN KEY (empresa_id, departamento_id) REFERENCES departamentos (empresa_id, id),
    UNIQUE (versao_id, categoria_id, centro_custo_id, departamento_id)
);

CREATE INDEX IF NOT EXISTS idx_orc_item_versao ON orcamento_item (versao_id);
CREATE INDEX IF NOT EXISTS idx_orc_item_empresa_cat ON orcamento_item (empresa_id, categoria_id);

COMMIT;