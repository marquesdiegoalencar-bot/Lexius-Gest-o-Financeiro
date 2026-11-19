CREATE TABLE IF NOT EXISTS senha_reset_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash    TEXT NOT NULL,
    expira_em     TIMESTAMPTZ NOT NULL,
    usado_em      TIMESTAMPTZ,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_senha_reset_tokens_usuario
  ON senha_reset_tokens (usuario_id);

CREATE INDEX IF NOT EXISTS idx_senha_reset_tokens_hash
  ON senha_reset_tokens (token_hash);