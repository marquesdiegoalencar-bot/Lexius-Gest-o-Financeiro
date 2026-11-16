/**
 * URLs oficiais da API Banking / OAuth (confirme em developers.inter.co).
 * Produção: cdpj.partners.bancointer.com.br
 * Sandbox: cdpj-sandbox.partners.uatinter.co
 */
export const INTER_API_BASE_PROD = 'https://cdpj.partners.bancointer.com.br';
export const INTER_API_BASE_SANDBOX = 'https://cdpj-sandbox.partners.uatinter.co';

export const INTER_PATH_TOKEN = '/oauth/v2/token';
export const INTER_PATH_SALDO = '/banking/v2/saldo';
export const INTER_PATH_EXTRATO = '/banking/v2/extrato';

/** Base relativos à URL .../cobranca/v3 */
export const INTER_COBRANCA_V3 = '/cobranca/v3';
export const INTER_COBRANCA_EMITIR = `${INTER_COBRANCA_V3}/cobrancas`;

/**
 * API Pix v2 (confirmado via documentação espelhada do portal Inter — paths abaixo).
 * Ver docs/INTER-PIX-COBV-API.md para confirmação no OpenAPI do portal.
 */
export const INTER_PIX_V2 = '/pix/v2';
export const interPixPathCobv = (txid: string) =>
  `${INTER_PIX_V2}/cobv/${encodeURIComponent(txid)}`;
export const interPixPathCobvPagamentoSandbox = (txid: string) =>
  `${INTER_PIX_V2}/cobv/${encodeURIComponent(txid)}/pagamento`;
export const interPixPathWebhook = (chavePix: string) =>
  `${INTER_PIX_V2}/webhook/${encodeURIComponent(chavePix)}`;