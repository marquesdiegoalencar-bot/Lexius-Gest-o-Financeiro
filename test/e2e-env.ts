/** Variáveis padrão para e2e (globalSetup + workers Jest). */
export function applyE2eEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.PORT = process.env.PORT ?? '0';
  process.env.DATABASE_URL =
    process.env.E2E_DATABASE_URL ??
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:5432/lexius_financeiro_test';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-jwt-secret-minimo-32-caracteres-xx';
  process.env.COB_INTEGRACAO_API_KEY = process.env.COB_INTEGRACAO_API_KEY ?? 'e2e-cob-api-key';
  process.env.COB_INTEGRACAO_HMAC_SECRET =
    process.env.COB_INTEGRACAO_HMAC_SECRET ?? 'e2e-hmac-secret';
  process.env.COB_EMPRESA_CNPJ = process.env.COB_EMPRESA_CNPJ ?? '00000000000191';
  process.env.STORAGE_LOCAL_PATH =
    process.env.STORAGE_LOCAL_PATH ?? '/tmp/lexius-e2e-storage';
  process.env.ANEXO_MAX_BYTES = process.env.ANEXO_MAX_BYTES ?? '10485760';
  process.env.ANEXO_MIME_ALLOWED =
    process.env.ANEXO_MIME_ALLOWED ??
    'application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  process.env.INTER_USE_MOCK = process.env.INTER_USE_MOCK ?? 'true';
  process.env.INTER_SANDBOX = process.env.INTER_SANDBOX ?? 'true';
  process.env.WEBHOOK_INTER_MOCK_SECRET =
    process.env.WEBHOOK_INTER_MOCK_SECRET ?? 'e2e-webhook-inter-secret';
  process.env.COB_RETORNO_API_KEY =
    process.env.COB_RETORNO_API_KEY ?? process.env.COB_INTEGRACAO_API_KEY ?? 'e2e-cob-api-key';
  process.env.COB_RETORNO_HMAC_SECRET =
    process.env.COB_RETORNO_HMAC_SECRET ??
    process.env.COB_INTEGRACAO_HMAC_SECRET ??
    'e2e-hmac-secret';
  process.env.COB_RETORNO_MAX_TENTATIVAS = process.env.COB_RETORNO_MAX_TENTATIVAS ?? '5';
}