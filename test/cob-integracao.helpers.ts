import { cobAssinarCorpoLegado, cobAssinarMensagem, cobVerificarAssinatura } from '../src/common/crypto/cob-hmac';

export const E2E_COB_API_KEY = process.env.COB_INTEGRACAO_API_KEY ?? 'e2e-cob-api-key';
export const E2E_HMAC_SECRET = process.env.COB_INTEGRACAO_HMAC_SECRET ?? 'e2e-hmac-secret';

/** Assinatura legada (somente corpo) — compatível com testes existentes. */
export function signCobBody(rawBody: string): string {
  return cobAssinarCorpoLegado(E2E_HMAC_SECRET, rawBody);
}

export function signCobBodyComTimestamp(rawBody: string, timestampUnix?: number) {
  const ts = String(timestampUnix ?? Math.floor(Date.now() / 1000));
  return {
    signature: cobAssinarMensagem(E2E_HMAC_SECRET, ts, rawBody),
    timestamp: ts,
  };
}

export function verifyCobRetornoBody(
  rawBody: string,
  assinatura: string,
  timestamp: string,
): boolean {
  return cobVerificarAssinatura({
    secret: process.env.COB_RETORNO_HMAC_SECRET ?? E2E_HMAC_SECRET,
    rawBody,
    assinatura,
    timestampHeader: timestamp,
    maxSkewSec: 300,
  }).ok;
}

export type AcordoPayload = {
  codigo: string;
  tipo: string;
  forma_pagamento: string;
  data_acordo: string;
  devedor: { nome: string; documento: string };
  credor: { nome: string };
  valor_original: number;
  desconto: number;
  valor_acordado: number;
  parcelas: Array<{
    id_parcela: string;
    numero: number;
    tipo: string;
    valor: number;
    vencimento: string;
  }>;
};

/** Payload espelhando ESPECIFICACAO.md (ACE202611110B4FDFEA). */
export function buildAcordoExemploSpec(codigo = 'ACE202611110B4FDFEA'): AcordoPayload {
  const suffix = codigo.replace(/[^a-zA-Z0-9]/g, '').slice(-8);
  return {
    codigo,
    tipo: 'PARCELADO_COM_ENTRADA',
    forma_pagamento: 'PIX',
    data_acordo: '2026-10-17',
    devedor: { nome: 'HEMELLY LIMA DOS SANTOS', documento: '55565700272' },
    credor: { nome: 'PAIVA & SANTOS LTDA ME' },
    valor_original: 923.2,
    desconto: 0,
    valor_acordado: 923.2,
    parcelas: [
      {
        id_parcela: `cob-${suffix}-entrada`,
        numero: 0,
        tipo: 'ENTRADA',
        valor: 100,
        vencimento: '2026-11-11',
      },
      {
        id_parcela: `cob-${suffix}-p1`,
        numero: 1,
        tipo: 'PARCELA',
        valor: 205.8,
        vencimento: '2026-12-09',
      },
      {
        id_parcela: `cob-${suffix}-p2`,
        numero: 2,
        tipo: 'PARCELA',
        valor: 205.8,
        vencimento: '2027-01-09',
      },
      {
        id_parcela: `cob-${suffix}-p3`,
        numero: 3,
        tipo: 'PARCELA',
        valor: 205.8,
        vencimento: '2027-02-09',
      },
      {
        id_parcela: `cob-${suffix}-p4`,
        numero: 4,
        tipo: 'PARCELA',
        valor: 205.8,
        vencimento: '2027-03-09',
      },
    ],
  };
}