-- Aprovação MASTER antes de baixa em títulos a pagar (Fase 2, §2.2)
ALTER TABLE titulos_pagar
    ADD COLUMN IF NOT EXISTS status_aprovacao TEXT NOT NULL DEFAULT 'PENDENTE'
        CHECK (status_aprovacao IN ('PENDENTE','APROVADO','REJEITADO'));
ALTER TABLE titulos_pagar ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES usuarios(id);
ALTER TABLE titulos_pagar ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;
ALTER TABLE titulos_pagar ADD COLUMN IF NOT EXISTS rejeitado_motivo TEXT;