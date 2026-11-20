-- Bloco D.1: departamento_id e centro_custo_id em títulos/recorrências; FKs compostas por empresa.
-- Transação atômica; falha antes de alterar estrutura se dados existentes forem inconsistentes.
--
-- Rollback manual (preserva histórico; NÃO usar DROP TABLE departamentos):
--   ALTER TABLE recorrencias DROP CONSTRAINT IF EXISTS recorrencias_centro_mesma_empresa_fkey;
--   ALTER TABLE recorrencias DROP CONSTRAINT IF EXISTS recorrencias_departamento_mesma_empresa_fkey;
--   ALTER TABLE titulos_pagar DROP CONSTRAINT IF EXISTS titulos_pagar_centro_mesma_empresa_fkey;
--   ALTER TABLE titulos_pagar DROP CONSTRAINT IF EXISTS titulos_pagar_departamento_mesma_empresa_fkey;
--   ALTER TABLE titulos_receber DROP CONSTRAINT IF EXISTS titulos_receber_centro_mesma_empresa_fkey;
--   ALTER TABLE titulos_receber DROP CONSTRAINT IF EXISTS titulos_receber_departamento_mesma_empresa_fkey;
--   DROP INDEX IF EXISTS idx_rec_empresa_centro_custo;
--   DROP INDEX IF EXISTS idx_rec_empresa_departamento;
--   DROP INDEX IF EXISTS idx_tp_empresa_centro_custo;
--   DROP INDEX IF EXISTS idx_tp_empresa_departamento;
--   DROP INDEX IF EXISTS idx_tr_empresa_centro_custo;
--   DROP INDEX IF EXISTS idx_tr_empresa_departamento;
--   ALTER TABLE recorrencias DROP COLUMN IF EXISTS centro_custo_id;
--   ALTER TABLE recorrencias DROP COLUMN IF EXISTS departamento_id;
--   ALTER TABLE titulos_pagar DROP COLUMN IF EXISTS departamento_id;
--   ALTER TABLE titulos_receber DROP COLUMN IF EXISTS departamento_id;
--   (Opcional, só se não houver outras FKs em departamentos) DROP INDEX IF EXISTS uq_departamentos_empresa_id;
--   Reaplicar FK simples em centro_custo_id nos títulos, se necessário para versão anterior.

BEGIN;

DO $$
DECLARE
  n_orphan_tr INT;
  n_cross_tr INT;
  n_orphan_tp INT;
  n_cross_tp INT;
BEGIN
  SELECT COUNT(*) INTO n_orphan_tr
  FROM titulos_receber t
  WHERE t.centro_custo_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM centros_custo c WHERE c.id = t.centro_custo_id);

  IF n_orphan_tr > 0 THEN
    RAISE EXCEPTION
      'Pré-check 013: titulos_receber com centro_custo_id inexistente (% linha(s)). Corrija antes de migrar.',
      n_orphan_tr;
  END IF;

  SELECT COUNT(*) INTO n_cross_tr
  FROM titulos_receber t
  INNER JOIN centros_custo c ON c.id = t.centro_custo_id
  WHERE t.centro_custo_id IS NOT NULL
    AND t.empresa_id <> c.empresa_id;

  IF n_cross_tr > 0 THEN
    RAISE EXCEPTION
      'Pré-check 013: titulos_receber com centro de outra empresa (% linha(s)). Corrija antes de migrar.',
      n_cross_tr;
  END IF;

  SELECT COUNT(*) INTO n_orphan_tp
  FROM titulos_pagar t
  WHERE t.centro_custo_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM centros_custo c WHERE c.id = t.centro_custo_id);

  IF n_orphan_tp > 0 THEN
    RAISE EXCEPTION
      'Pré-check 013: titulos_pagar com centro_custo_id inexistente (% linha(s)). Corrija antes de migrar.',
      n_orphan_tp;
  END IF;

  SELECT COUNT(*) INTO n_cross_tp
  FROM titulos_pagar t
  INNER JOIN centros_custo c ON c.id = t.centro_custo_id
  WHERE t.centro_custo_id IS NOT NULL
    AND t.empresa_id <> c.empresa_id;

  IF n_cross_tp > 0 THEN
    RAISE EXCEPTION
      'Pré-check 013: titulos_pagar com centro de outra empresa (% linha(s)). Corrija antes de migrar.',
      n_cross_tp;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_departamentos_empresa_id
  ON departamentos (empresa_id, id);

ALTER TABLE titulos_receber
  ADD COLUMN IF NOT EXISTS departamento_id UUID;

ALTER TABLE titulos_pagar
  ADD COLUMN IF NOT EXISTS departamento_id UUID;

ALTER TABLE recorrencias
  ADD COLUMN IF NOT EXISTS departamento_id UUID;

ALTER TABLE recorrencias
  ADD COLUMN IF NOT EXISTS centro_custo_id UUID;

ALTER TABLE titulos_receber
  DROP CONSTRAINT IF EXISTS titulos_receber_centro_custo_id_fkey;

ALTER TABLE titulos_pagar
  DROP CONSTRAINT IF EXISTS titulos_pagar_centro_custo_id_fkey;

DO $$ BEGIN
  ALTER TABLE titulos_receber ADD CONSTRAINT titulos_receber_departamento_mesma_empresa_fkey
    FOREIGN KEY (empresa_id, departamento_id)
    REFERENCES departamentos (empresa_id, id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE titulos_receber ADD CONSTRAINT titulos_receber_centro_mesma_empresa_fkey
    FOREIGN KEY (empresa_id, centro_custo_id)
    REFERENCES centros_custo (empresa_id, id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE titulos_pagar ADD CONSTRAINT titulos_pagar_departamento_mesma_empresa_fkey
    FOREIGN KEY (empresa_id, departamento_id)
    REFERENCES departamentos (empresa_id, id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE titulos_pagar ADD CONSTRAINT titulos_pagar_centro_mesma_empresa_fkey
    FOREIGN KEY (empresa_id, centro_custo_id)
    REFERENCES centros_custo (empresa_id, id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE recorrencias ADD CONSTRAINT recorrencias_departamento_mesma_empresa_fkey
    FOREIGN KEY (empresa_id, departamento_id)
    REFERENCES departamentos (empresa_id, id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE recorrencias ADD CONSTRAINT recorrencias_centro_mesma_empresa_fkey
    FOREIGN KEY (empresa_id, centro_custo_id)
    REFERENCES centros_custo (empresa_id, id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_tr_empresa_departamento
  ON titulos_receber (empresa_id, departamento_id)
  WHERE departamento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tr_empresa_centro_custo
  ON titulos_receber (empresa_id, centro_custo_id)
  WHERE centro_custo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tp_empresa_departamento
  ON titulos_pagar (empresa_id, departamento_id)
  WHERE departamento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tp_empresa_centro_custo
  ON titulos_pagar (empresa_id, centro_custo_id)
  WHERE centro_custo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rec_empresa_departamento
  ON recorrencias (empresa_id, departamento_id)
  WHERE departamento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rec_empresa_centro_custo
  ON recorrencias (empresa_id, centro_custo_id)
  WHERE centro_custo_id IS NOT NULL;

COMMIT;