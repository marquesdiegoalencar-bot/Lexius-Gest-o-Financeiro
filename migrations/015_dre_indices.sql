-- Bloco F: índices para consultas de DRE (competência e caixa). Sem materializações pesadas.
-- Transação atômica.
--
-- Rollback manual:
--   DROP INDEX IF EXISTS idx_tp_competencia_empresa;
--   DROP INDEX IF EXISTS idx_tr_competencia_empresa;
--   DROP INDEX IF EXISTS idx_baixas_empresa_data_ativa;
--   DROP INDEX IF EXISTS idx_bai_empresa_centro;
--   DROP INDEX IF EXISTS idx_bai_empresa_departamento;

BEGIN;

CREATE INDEX IF NOT EXISTS idx_tr_competencia_empresa
  ON titulos_receber (empresa_id, data_competencia)
  WHERE data_competencia IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tp_competencia_empresa
  ON titulos_pagar (empresa_id, data_competencia)
  WHERE data_competencia IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_baixas_empresa_data_ativa
  ON baixas (empresa_id, data_baixa)
  WHERE estornada = FALSE;

CREATE INDEX IF NOT EXISTS idx_bai_empresa_centro
  ON baixa_alocacao_item (empresa_id, centro_custo_id)
  WHERE centro_custo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bai_empresa_departamento
  ON baixa_alocacao_item (empresa_id, departamento_id)
  WHERE departamento_id IS NOT NULL;

COMMIT;