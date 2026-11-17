CREATE TABLE IF NOT EXISTS cobranca_emissao_pendente (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id         UUID NOT NULL REFERENCES empresas(id),
    titulo_receber_id  UUID NOT NULL REFERENCES titulos_receber(id) ON DELETE CASCADE,
    conta_bancaria_id  UUID REFERENCES contas_bancarias(id),
    modalidade         modalidade_cobranca NOT NULL DEFAULT 'PIX_COBV',
    ultimo_erro        TEXT NOT NULL,
    tentativas         SMALLINT NOT NULL DEFAULT 0,
    criada_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolvida_em       TIMESTAMPTZ,
    UNIQUE (titulo_receber_id, modalidade)
);

CREATE INDEX IF NOT EXISTS idx_emissao_pendente_aberta
  ON cobranca_emissao_pendente (resolvida_em)
  WHERE resolvida_em IS NULL;