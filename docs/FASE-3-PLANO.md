# Fase 3 — Integração bancária (PRs sequenciais)

| PR | Branch sugerida | Base | Escopo |
|----|-----------------|------|--------|
| **3A** | `cursor/pr-3a-banco-bafb` | `cursor/etapa-b-fase-2-bafb` | `BancoProvider`, Inter saldo/extrato, credenciais por env |
| **3B** | `cursor/pr-3b-cobranca-bafb` | 3A | Emissão cobrança v3, webhook mTLS, baixa automática, job consulta |
| **3B-2** | `cursor/pr-3b2-pix-cobv-bafb` | 3B | Pix cobrança com vencimento (`/pix/v2/cobv`), título só-Pix |
| **3C** | `cursor/pr-3c-cob-retorno-bafb` | 3B-2 | Webhooks HMAC `titulo.baixado` / `acordo.atualizado` ao COB |

## PR 3B-2 — Pix cobrança vencimento (cobv) — entregue

Documentação: `docs/INTER-PIX-COBV-API.md`. API **Pix v2**, distinta da Cobrança v3.

| Operação | Path | Escopos |
|----------|------|---------|
| Emitir cobv | `PUT /pix/v2/cobv/{txid}` | `cobv.write` |
| Consultar cobv | `GET /pix/v2/cobv/{txid}` | `cobv.read` |
| Webhook Pix (por chave) | `PUT /pix/v2/webhook/{chave}` | `webhook.write` |
| Callback pagamento | validação **mTLS** (mesmo modelo de callback) | — |

Endpoints Lexius: `POST /v1/titulos-receber/:id/emitir-pix-cobv`, `reemitir-pix-cobv`, acordo COB Pix emite cobv por parcela; `POST /v1/contas-bancarias/:id/inter-pix-webhook` (MASTER).

**Chave Pix:** cadastrada na conta Inter; emissão v3 usa chave padrão automaticamente; em cobv a chave entra no path do webhook e no payload (`chave` / `chavePix` conforme spec BACEN/Inter).

**Pendência:** payload exato de callback Pix — aguardar exemplo sandbox ou doc OpenAPI no portal.

## Credenciais Inter

`credencial_ref` no banco; material em `BANCO_CRED_{REF}_*`. Em produção `INTER_USE_MOCK` e `WEBHOOK_INTER_MOCK_SECRET` **proibidos** (app não sobe).

## Header `x-conta-corrente`

**Condicional:** obrigatório quando a integração PJ acessa **mais de uma** conta corrente (SDK Inter / conectores oficiais). Enviamos o número de `contas_bancarias.conta` (só dígitos) em toda chamada Cobrança v3.

## Tarifa por cobrança (3B)

Tabela `conta_tarifas_cobranca` (`conta_bancaria_id` + `forma` BOLETO/PIX + `valor_tarifa`).

API:

- `GET /v1/contas-bancarias/:id/tarifas-cobranca`
- `POST /v1/contas-bancarias/:id/tarifas-cobranca` — body `{ forma, valor_tarifa }`

Usada na baixa automática (movimento `TARIFA` separado, mesma regra da baixa manual).

## Endpoints Cobrança v3 (confirmados)

Base: `{host}/cobranca/v3`

- `POST /cobrancas`
- `GET /cobrancas/{codigoSolicitacao}`
- `POST /cobrancas/{codigoSolicitacao}/cancelar`
- `PUT /cobrancas/webhook` — cadastro URL callback

## Webhook recebimento (3B)

- `POST /v1/webhooks/inter` — produção: **mTLS** (`req.client.authorized` + certificado)
- Teste/mock: `INTER_USE_MOCK=true` + header `X-Inter-Mock-Secret`
- Webhook **não confia** no corpo: agenda **GET** cobrança e só então baixa
- Payload não mapeado → `webhook_eventos.revisao_manual = true`, sem baixa
- Job `COBRANCA_POLL_INTERVAL_MS` reprocessa pendentes e consulta cobranças abertas