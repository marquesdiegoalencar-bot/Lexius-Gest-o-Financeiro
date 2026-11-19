-- Bloco B (correção): pai e filho na mesma empresa (FK composta).
-- Pré-requisito: nenhum registro com pai de outra empresa:
--   SELECT 1 FROM centros_custo c JOIN centros_custo p ON p.id = c.pai_id
--   WHERE c.pai_id IS NOT NULL AND c.empresa_id <> p.empresa_id LIMIT 1;
--
-- Rollback manual (após backup):
--   ALTER TABLE centros_custo DROP CONSTRAINT IF EXISTS centros_custo_pai_mesma_empresa_fkey;
--   DROP INDEX IF EXISTS uq_centros_custo_empresa_id;
--   ALTER TABLE centros_custo ADD CONSTRAINT centros_custo_pai_id_fkey
--     FOREIGN KEY (pai_id) REFERENCES centros_custo(id);
-- Limitação: volta à FK simples em id apenas (sem garantia cross-empresa no banco).

ALTER TABLE centros_custo DROP CONSTRAINT IF EXISTS centros_custo_pai_id_fkey;

CREATE UNIQUE INDEX IF NOT EXISTS uq_centros_custo_empresa_id
  ON centros_custo (empresa_id, id);

DO $$ BEGIN
  ALTER TABLE centros_custo ADD CONSTRAINT centros_custo_pai_mesma_empresa_fkey
    FOREIGN KEY (empresa_id, pai_id)
    REFERENCES centros_custo (empresa_id, id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;