-- Bloco E: rateio por título (definição, vigências, alocação em baixa) + recorrencia_id em titulos_receber.
-- Transação atômica.
--
-- Rollback manual (preserva histórico em baixas; remover na ordem inversa das FKs):
--   DROP TRIGGER IF EXISTS trg_titulo_rateio_vigencia_no_overlap ON titulo_rateio_vigencia;
--   DROP FUNCTION IF EXISTS trg_titulo_rateio_vigencia_no_overlap();
--   DROP TABLE IF EXISTS baixa_alocacao_item;
--   DROP TABLE IF EXISTS titulo_rateio_vigencia_item;
--   DROP TABLE IF EXISTS titulo_rateio_vigencia;
--   DROP TABLE IF EXISTS titulo_alocacao_item;
--   DROP TABLE IF EXISTS titulo_alocacao_definicao;
--   DROP INDEX IF EXISTS uq_tr_recorrencia_vencimento;
--   ALTER TABLE titulos_receber DROP CONSTRAINT IF EXISTS titulos_receber_recorrencia_id_fkey;
--   ALTER TABLE titulos_receber DROP COLUMN IF EXISTS recorrencia_id;
--   DROP TYPE IF EXISTS tipo_baixa_alocacao;
--   DROP TYPE IF EXISTS origem_titulo_rateio_vigencia;
--   DROP TYPE IF EXISTS status_titulo_alocacao;
--   DROP TYPE IF EXISTS modo_rateio;

BEGIN;

DO $$ BEGIN
  CREATE TYPE modo_rateio AS ENUM ('PERCENTUAL', 'VALOR_FIXO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_titulo_alocacao AS ENUM ('RASCUNHO', 'CONFIRMADO', 'CANCELADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE origem_titulo_rateio_vigencia AS ENUM ('LEGADO', 'CONFIRMACAO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_baixa_alocacao AS ENUM ('BAIXA', 'ESTORNO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS titulo_alocacao_definicao (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id           UUID NOT NULL REFERENCES empresas(id),
    titulo_receber_id    UUID REFERENCES titulos_receber(id),
    titulo_pagar_id      UUID REFERENCES titulos_pagar(id),
    modo                 modo_rateio NOT NULL DEFAULT 'PERCENTUAL',
    status               status_titulo_alocacao NOT NULL DEFAULT 'RASCUNHO',
    criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
      (titulo_receber_id IS NOT NULL)::int + (titulo_pagar_id IS NOT NULL)::int = 1
    )
);

CREATE INDEX IF NOT EXISTS idx_tad_empresa_tr
  ON titulo_alocacao_definicao (empresa_id, titulo_receber_id)
  WHERE titulo_receber_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tad_empresa_tp
  ON titulo_alocacao_definicao (empresa_id, titulo_pagar_id)
  WHERE titulo_pagar_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tad_rascunho_tr
  ON titulo_alocacao_definicao (empresa_id, titulo_receber_id)
  WHERE titulo_receber_id IS NOT NULL AND status = 'RASCUNHO';

CREATE UNIQUE INDEX IF NOT EXISTS uq_tad_rascunho_tp
  ON titulo_alocacao_definicao (empresa_id, titulo_pagar_id)
  WHERE titulo_pagar_id IS NOT NULL AND status = 'RASCUNHO';

CREATE TABLE IF NOT EXISTS titulo_alocacao_item (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definicao_id      UUID NOT NULL REFERENCES titulo_alocacao_definicao(id) ON DELETE CASCADE,
    empresa_id        UUID NOT NULL REFERENCES empresas(id),
    linha             SMALLINT NOT NULL CHECK (linha > 0),
    centro_custo_id   UUID,
    departamento_id   UUID,
    percentual        NUMERIC(9,4),
    valor             NUMERIC(14,2),
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (empresa_id, centro_custo_id) REFERENCES centros_custo (empresa_id, id),
  FOREIGN KEY (empresa_id, departamento_id) REFERENCES departamentos (empresa_id, id),
    CHECK (centro_custo_id IS NOT NULL OR departamento_id IS NOT NULL),
    CHECK (
      (percentual IS NOT NULL AND valor IS NULL)
      OR (percentual IS NULL AND valor IS NOT NULL)
    ),
    UNIQUE (definicao_id, linha)
);

CREATE TABLE IF NOT EXISTS titulo_rateio_vigencia (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id         UUID NOT NULL REFERENCES empresas(id),
    titulo_receber_id  UUID REFERENCES titulos_receber(id),
    titulo_pagar_id    UUID REFERENCES titulos_pagar(id),
    definicao_id       UUID REFERENCES titulo_alocacao_definicao(id),
    origem             origem_titulo_rateio_vigencia NOT NULL,
    modo               modo_rateio NOT NULL DEFAULT 'PERCENTUAL',
    valido_de          DATE NOT NULL,
    valido_ate         DATE,
    criado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
      (titulo_receber_id IS NOT NULL)::int + (titulo_pagar_id IS NOT NULL)::int = 1
    ),
    CHECK (valido_ate IS NULL OR valido_ate >= valido_de)
);

CREATE INDEX IF NOT EXISTS idx_trv_empresa_tr
  ON titulo_rateio_vigencia (empresa_id, titulo_receber_id, valido_de DESC)
  WHERE titulo_receber_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trv_empresa_tp
  ON titulo_rateio_vigencia (empresa_id, titulo_pagar_id, valido_de DESC)
  WHERE titulo_pagar_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS titulo_rateio_vigencia_item (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vigencia_id       UUID NOT NULL REFERENCES titulo_rateio_vigencia(id) ON DELETE CASCADE,
    empresa_id        UUID NOT NULL REFERENCES empresas(id),
    linha             SMALLINT NOT NULL CHECK (linha > 0),
    centro_custo_id   UUID,
    departamento_id   UUID,
    percentual        NUMERIC(9,4),
    valor             NUMERIC(14,2),
  FOREIGN KEY (empresa_id, centro_custo_id) REFERENCES centros_custo (empresa_id, id),
  FOREIGN KEY (empresa_id, departamento_id) REFERENCES departamentos (empresa_id, id),
    CHECK (centro_custo_id IS NOT NULL OR departamento_id IS NOT NULL),
    UNIQUE (vigencia_id, linha)
);

CREATE TABLE IF NOT EXISTS baixa_alocacao_item (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          UUID NOT NULL REFERENCES empresas(id),
    baixa_id            UUID NOT NULL REFERENCES baixas(id),
    tipo                tipo_baixa_alocacao NOT NULL DEFAULT 'BAIXA',
    linha               SMALLINT NOT NULL CHECK (linha > 0),
    centro_custo_id     UUID,
    departamento_id     UUID,
    valor               NUMERIC(14,2) NOT NULL,
    percentual_ref      NUMERIC(9,4),
    vigencia_id         UUID REFERENCES titulo_rateio_vigencia(id),
    estorno_de_id       UUID REFERENCES baixa_alocacao_item(id),
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (empresa_id, centro_custo_id) REFERENCES centros_custo (empresa_id, id),
  FOREIGN KEY (empresa_id, departamento_id) REFERENCES departamentos (empresa_id, id),
    CHECK (centro_custo_id IS NOT NULL OR departamento_id IS NOT NULL),
    UNIQUE (baixa_id, tipo, linha)
);

CREATE INDEX IF NOT EXISTS idx_bai_baixa ON baixa_alocacao_item (baixa_id);
CREATE INDEX IF NOT EXISTS idx_bai_empresa ON baixa_alocacao_item (empresa_id);

-- titulos_receber: idempotência por recorrência + vencimento
ALTER TABLE titulos_receber
  ADD COLUMN IF NOT EXISTS recorrencia_id UUID;

DO $$ BEGIN
  ALTER TABLE titulos_receber
    ADD CONSTRAINT titulos_receber_recorrencia_id_fkey
    FOREIGN KEY (recorrencia_id) REFERENCES recorrencias(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tr_recorrencia_vencimento
  ON titulos_receber (empresa_id, recorrencia_id, data_vencimento)
  WHERE recorrencia_id IS NOT NULL;

-- Anti-sobreposição de vigências (sem btree_gist)
CREATE OR REPLACE FUNCTION trg_titulo_rateio_vigencia_no_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  conflito INT;
BEGIN
  SELECT COUNT(*) INTO conflito
  FROM titulo_rateio_vigencia v
  WHERE v.empresa_id = NEW.empresa_id
    AND v.id IS DISTINCT FROM NEW.id
    AND (
      (NEW.titulo_receber_id IS NOT NULL AND v.titulo_receber_id = NEW.titulo_receber_id)
      OR (NEW.titulo_pagar_id IS NOT NULL AND v.titulo_pagar_id = NEW.titulo_pagar_id)
    )
    AND daterange(v.valido_de, COALESCE(v.valido_ate, 'infinity'::date), '[]')
        && daterange(NEW.valido_de, COALESCE(NEW.valido_ate, 'infinity'::date), '[]');

  IF conflito > 0 THEN
    RAISE EXCEPTION
      'Vigência de rateio sobrepõe vigência existente para o mesmo título';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_titulo_rateio_vigencia_no_overlap ON titulo_rateio_vigencia;
CREATE TRIGGER trg_titulo_rateio_vigencia_no_overlap
  BEFORE INSERT OR UPDATE OF valido_de, valido_ate, titulo_receber_id, titulo_pagar_id, empresa_id
  ON titulo_rateio_vigencia
  FOR EACH ROW
  EXECUTE PROCEDURE trg_titulo_rateio_vigencia_no_overlap();

-- Backfill LEGADO: 100% no centro/departamento do título (quando houver)
INSERT INTO titulo_rateio_vigencia (
  empresa_id, titulo_receber_id, origem, modo, valido_de, valido_ate
)
SELECT
  t.empresa_id,
  t.id,
  'LEGADO',
  'PERCENTUAL',
  t.data_emissao,
  NULL
FROM titulos_receber t
WHERE (t.centro_custo_id IS NOT NULL OR t.departamento_id IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM titulo_rateio_vigencia v WHERE v.titulo_receber_id = t.id
  );

INSERT INTO titulo_rateio_vigencia_item (
  vigencia_id, empresa_id, linha, centro_custo_id, departamento_id, percentual
)
SELECT
  v.id,
  v.empresa_id,
  1,
  t.centro_custo_id,
  t.departamento_id,
  100
FROM titulo_rateio_vigencia v
JOIN titulos_receber t ON t.id = v.titulo_receber_id
WHERE v.origem = 'LEGADO'
  AND NOT EXISTS (SELECT 1 FROM titulo_rateio_vigencia_item i WHERE i.vigencia_id = v.id);

INSERT INTO titulo_rateio_vigencia (
  empresa_id, titulo_pagar_id, origem, modo, valido_de, valido_ate
)
SELECT
  t.empresa_id,
  t.id,
  'LEGADO',
  'PERCENTUAL',
  t.data_emissao,
  NULL
FROM titulos_pagar t
WHERE (t.centro_custo_id IS NOT NULL OR t.departamento_id IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM titulo_rateio_vigencia v WHERE v.titulo_pagar_id = t.id
  );

INSERT INTO titulo_rateio_vigencia_item (
  vigencia_id, empresa_id, linha, centro_custo_id, departamento_id, percentual
)
SELECT
  v.id,
  v.empresa_id,
  1,
  t.centro_custo_id,
  t.departamento_id,
  100
FROM titulo_rateio_vigencia v
JOIN titulos_pagar t ON t.id = v.titulo_pagar_id
WHERE v.origem = 'LEGADO'
  AND NOT EXISTS (SELECT 1 FROM titulo_rateio_vigencia_item i WHERE i.vigencia_id = v.id);

COMMIT;