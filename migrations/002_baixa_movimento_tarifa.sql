-- Movimento bancário da tarifa (separado do valor principal da baixa)
ALTER TABLE baixas
    ADD COLUMN IF NOT EXISTS movimento_tarifa_id UUID REFERENCES movimentos_bancarios(id);