-- Tarifa padrão de cobrança por conta e forma (boleto/Pix)
CREATE TABLE IF NOT EXISTS conta_tarifas_cobranca (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_bancaria_id UUID NOT NULL REFERENCES contas_bancarias(id) ON DELETE CASCADE,
    forma             forma_pagamento NOT NULL,
    valor_tarifa      NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor_tarifa >= 0),
    UNIQUE (conta_bancaria_id, forma)
);

ALTER TABLE webhook_eventos
    ADD COLUMN IF NOT EXISTS revisao_manual BOOLEAN NOT NULL DEFAULT FALSE;