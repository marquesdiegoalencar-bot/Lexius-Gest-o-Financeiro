# PR 3C — Retorno Financeiro → Lexius COB (planejado)

**Branch:** `cursor/pr-3c-cob-retorno-bafb` · **Base:** `cursor/pr-3b2-pix-cobv-bafb`  
**Escopo:** notificar o COB após baixa (manual ou automática); **não alterar** o repositório do COB.

## Princípios

1. Baixa no Financeiro é **irreversível** por falha de envio ao COB.
2. Parcela só é considerada “comunicada ao COB” após **HTTP 2xx** + registro em `cob_integracao_eventos.enviado_em`.
3. Retentativa até `COB_RETORNO_MAX_TENTATIVAS`; após isso status `FALHOU` (MASTER lista e reenvia).
4. Idempotência por `idempotency_key` (ex. `{baixa_id}:titulo.baixado`).
5. Assinatura v2: **HMAC-SHA256** sobre `X-Timestamp` + corpo; janela 5 min. Entrada COB aceita legado (só corpo).
6. `acordo.atualizado` em **toda** baixa e todo estorno, com todas as parcelas; ordem por acordo.
7. Aviso `titulo.estornado` após estorno MASTER.

## Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `COB_RETORNO_URL` | POST destino (webhook do COB) |
| `COB_RETORNO_API_KEY` | Header `X-Api-Key` |
| `COB_RETORNO_HMAC_SECRET` | HMAC do body (pode ser o mesmo `COB_INTEGRACAO_HMAC_SECRET` se acordado) |
| `COB_RETORNO_POLL_MS` | Intervalo do job (opcional; default junto com poll de cobrança) |

## Tabela `cob_integracao_eventos` (saída)

| Coluna | Descrição |
|--------|-----------|
| `id` | UUID (`evento_id` no payload) |
| `tipo_evento` | `titulo.baixado` \| `titulo.estornado` \| `acordo.atualizado` |
| `baixa_id` | FK baixas |
| `titulo_receber_id` | FK |
| `cobranca_parcela_id` | Texto COB |
| `payload` | JSON enviado |
| `enviado_em` | null até sucesso |
| `tentativas`, `ultimo_erro`, `http_status` | auditoria / retry |
| `idempotency_key` | UNIQUE — `{baixa_id}:{tipo}` |

## Gatilho

Após `BaixasService` concluir baixa de título com `origem IN (COBRANCA_ACORDO, COBRANCA_BOLETO)` e `cobranca_parcela_id` preenchido:

1. Enfileirar `titulo.baixado` (sempre).
2. Enfileirar sempre `acordo.atualizado` com snapshot de todas as parcelas.
3. Estorno MASTER → `titulo.estornado` + `acordo.atualizado`.

Processamento assíncrono (`setImmediate` / job) — não bloquear resposta da baixa.

## Formato do aviso (corpo JSON)

Envelope comum:

```json
{
  "evento_id": "uuid-v4",
  "tipo": "titulo.baixado",
  "gerado_em": "2026-11-16T17:00:00-04:00",
  "versao": 1,
  "dados": { }
}
```

Headers:

- `Content-Type: application/json`
- `X-Api-Key: <COB_RETORNO_API_KEY>`
- `X-Timestamp: unix` (v2)
- `X-Signature: hex(hmac_sha256(secret, timestamp + '.' + raw_body))`

Documentação completa: [CONTRATO-COB.md](./CONTRATO-COB.md).

### `titulo.baixado`

```json
{
  "evento_id": "f8c2b0a2-…",
  "tipo": "titulo.baixado",
  "gerado_em": "2026-11-16T17:00:00-04:00",
  "versao": 1,
  "dados": {
    "codigo_acordo": "ACE202611110B4FDFEA",
    "id_parcela": "cob-…-p1",
    "titulo_financeiro_id": "uuid",
    "baixa_id": "uuid",
    "valor_recebido": 205.80,
    "valor_liquido": 202.30,
    "data_baixa": "2026-12-10",
    "forma": "PIX",
    "automatica": true,
    "status_titulo": "PAGO",
    "saldo_parcela": 0
  }
}
```

Campos alinhados a `ESPECIFICACAO.md` §3.1.1 (`codigo`, `id_parcela`, `valor_recebido`, `data`, `forma`).

### `acordo.atualizado`

Enviado quando não restam parcelas em aberto no acordo:

```json
{
  "evento_id": "a1b2c3d4-…",
  "tipo": "acordo.atualizado",
  "gerado_em": "2026-11-16T17:00:00-04:00",
  "versao": 1,
  "dados": {
    "codigo_acordo": "ACE202611110B4FDFEA",
    "status_pagamento_financeiro": "QUITADO",
    "valor_acordado": 923.20,
    "valor_recebido_total": 923.20,
    "parcelas": [
      {
        "id_parcela": "cob-…-entrada",
        "status": "PAGO",
        "valor_recebido": 100.00,
        "saldo": 0
      }
    ]
  }
}
```

`status_pagamento_financeiro`: `QUITADO` \| `PARCIAL` \| `EM_ABERTO` (calculado no Financeiro; o COB decide o status de negócio local).

## HTTP cliente

- `POST COB_RETORNO_URL` com timeout (ex. 15s).
- 2xx → `enviado_em`, limpa `ultimo_erro`.
- 4xx/5xx/rede → incrementa `tentativas`, grava erro; **não** estorna baixa.
- Job: reprocessa `enviado_em IS NULL` ordenado por `criada_em`.

## Módulos (implementação futura)

- `src/modules/integracao-cobranca-retorno/` — service, job, http client
- Hook em `BaixasService` (após commit) via evento interno ou chamada explícita ao retorno service
- E2e: mock HTTP server (nock ou listen 0) validando HMAC + idempotência (duas baixas não duplicam; retry após 500)

## Testes obrigatórios

1. Baixa automática Inter → evento `titulo.baixado` enfileirado → mock 200 → `enviado_em` preenchido.
2. Mock 500 → baixa permanece; job reenvia e confirma.
3. Última parcela paga → `acordo.atualizado` adicional.
4. Mesmo `baixa_id` não gera segundo POST distinto (idempotency_key).

## Fora de escopo 3C

- Alterações no repositório Lexius COB.
- Polling do COB para “confirmar” leitura (opcional fase futura: `COB_CONFIRMA_LEITURA`).