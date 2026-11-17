DO $$ BEGIN
  CREATE TYPE status_cob_retorno AS ENUM ('PENDENTE', 'ENVIADO', 'FALHOU');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cob_retorno_eventos (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id         UUID NOT NULL REFERENCES empresas(id),
    tipo_evento        TEXT NOT NULL,
    codigo_acordo      TEXT,
    ordem_no_acordo    INTEGER NOT NULL DEFAULT 0,
    baixa_id           UUID REFERENCES baixas(id),
    titulo_receber_id  UUID REFERENCES titulos_receber(id),
    idempotency_key    TEXT NOT NULL UNIQUE,
    payload            JSONB NOT NULL,
    status             status_cob_retorno NOT NULL DEFAULT 'PENDENTE',
    tentativas         SMALLINT NOT NULL DEFAULT 0,
    ultimo_erro        TEXT,
    http_status        SMALLINT,
    enviado_em         TIMESTAMPTZ,
    criada_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cob_retorno_pendentes
  ON cob_retorno_eventos (status, codigo_acordo, ordem_no_acordo, criada_em)
  WHERE status = 'PENDENTE';

CREATE INDEX IF NOT EXISTS idx_cob_retorno_falhou
  ON cob_retorno_eventos (status, criada_em DESC)
  WHERE status = 'FALHOU';