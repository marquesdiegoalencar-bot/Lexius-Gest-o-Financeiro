#!/usr/bin/env node
const { createHmac } = require('crypto');

const API_KEY = process.env.COB_INTEGRACAO_API_KEY || 'dev-cob-api-key';
const HMAC_SECRET = process.env.COB_INTEGRACAO_HMAC_SECRET || 'dev-hmac-secret';
const BASE = process.env.API_BASE || 'http://127.0.0.1:3000';

const payload = {
  codigo: 'ACE202611110B4FDFEA',
  tipo: 'PARCELADO_COM_ENTRADA',
  forma_pagamento: 'PIX',
  data_acordo: '2026-10-17',
  devedor: { nome: 'HEMELLY LIMA DOS SANTOS', documento: '55565700272' },
  credor: { nome: 'PAIVA & SANTOS LTDA ME' },
  valor_original: 923.2,
  desconto: 0,
  valor_acordado: 923.2,
  parcelas: [
    { id_parcela: 'cob-ace-entrada', numero: 0, tipo: 'ENTRADA', valor: 100, vencimento: '2026-11-11' },
    { id_parcela: 'cob-ace-p1', numero: 1, tipo: 'PARCELA', valor: 205.8, vencimento: '2026-12-09' },
    { id_parcela: 'cob-ace-p2', numero: 2, tipo: 'PARCELA', valor: 205.8, vencimento: '2027-01-09' },
    { id_parcela: 'cob-ace-p3', numero: 3, tipo: 'PARCELA', valor: 205.8, vencimento: '2027-02-09' },
    { id_parcela: 'cob-ace-p4', numero: 4, tipo: 'PARCELA', valor: 205.8, vencimento: '2027-03-09' },
  ],
};

function sign(body) {
  return createHmac('sha256', HMAC_SECRET).update(body).digest('hex');
}

async function postAcordo(body, signature) {
  const res = await fetch(`${BASE}/v1/integracao/cobranca/acordos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': API_KEY,
      'X-Signature': signature,
    },
    body,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function main() {
  const body = JSON.stringify(payload);
  const sig = sign(body);

  console.log('=== 1ª chamada (criação) ===');
  const r1 = await postAcordo(body, sig);
  console.log('HTTP', r1.status);
  console.log(JSON.stringify(r1.json, null, 2));

  console.log('\n=== 2ª chamada (idempotente) ===');
  const r2 = await postAcordo(body, sig);
  console.log('HTTP', r2.status);
  console.log('idempotente:', r2.json?.idempotente);
  console.log('titulos count:', r2.json?.titulos?.length);

  console.log('\n=== HMAC inválido ===');
  const r3 = await postAcordo(body, 'deadbeef'.repeat(8));
  console.log('HTTP', r3.status);
  console.log(JSON.stringify(r3.json, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});