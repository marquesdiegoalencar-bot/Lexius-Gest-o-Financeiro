# Contrato de integração — Financeiro ↔ Lexius COB

Este documento descreve a **API de entrada** (COB → Financeiro) e os **avisos de retorno** (Financeiro → COB) após PR 3C.

## Autenticação e assinatura HMAC

Em ambas as direções:

| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `Content-Type` | Sim | `application/json` |
| `X-Api-Key` | Sim | Chave acordada (`COB_INTEGRACAO_API_KEY` / `COB_RETORNO_API_KEY`) |
| `X-Signature` | Sim | HMAC-SHA256 em hexadecimal |
| `X-Timestamp` | Recomendado (v2) | Segundos UNIX; quando presente, participa da assinatura |

### Modo v2 (preferencial)

```
mensagem = {X-Timestamp}.{corpo_bruto_UTF8}
X-Signature = HMAC-SHA256(secret, mensagem)
```

O **receptor deve rejeitar** requisições cujo `X-Timestamp` difira mais de **5 minutos** (300 s) do relógio do servidor. Variável de ambiente: `COB_INTEGRACAO_HMAC_MAX_SKEW_SECONDS`.

### Modo legado (compatibilidade)

Sem header `X-Timestamp`, a assinatura continua sendo apenas sobre o **corpo bruto** (comportamento anterior dos testes e integrações antigas).

### Exemplo `curl` — entrada de acordo (v2)

```bash
BODY='{"codigo":"ACE202611110B4FDFEA",...}'
TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$COB_INTEGRACAO_HMAC_SECRET" | awk '{print $2}')

curl -sS -X POST "$FINANCEIRO_URL/v1/integracao/cobranca/acordos" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $COB_INTEGRACAO_API_KEY" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  --data-binary "$BODY"
```

### Exemplo `curl` — aviso de retorno (v2)

```bash
BODY='{"evento_id":"...","tipo":"titulo.baixado",...}'
TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$COB_RETORNO_HMAC_SECRET" | awk '{print $2}')

curl -sS -X POST "$COB_RETORNO_URL" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $COB_RETORNO_API_KEY" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  --data-binary "$BODY"
```

---

## Avisos de retorno (Financeiro → COB)

`POST` no `COB_RETORNO_URL` configurado no Financeiro. Cada aviso é enviado **individualmente**; para o mesmo acordo, os envios respeitam `ordem_no_acordo` (um POST por vez, na ordem).

### Envelope comum

```json
{
  "evento_id": "uuid-v4",
  "tipo": "<tipo>",
  "gerado_em": "2026-11-16T20:00:00.000Z",
  "versao": 2,
  "dados": { }
}
```

### `titulo.baixado`

Disparado após baixa (manual ou automática) de parcela de acordo COB.

```json
{
  "dados": {
    "codigo_acordo": "ACE202611110B4FDFEA",
    "id_parcela": "cob-xxx-p1",
    "titulo_financeiro_id": "uuid",
    "baixa_id": "uuid",
    "valor_recebido": 205.8,
    "valor_liquido": 202.3,
    "data_baixa": "2026-12-10",
    "forma": "PIX",
    "automatica": true,
    "status_titulo": "PAGO",
    "saldo_parcela": 0
  }
}
```

### `titulo.estornado`

Disparado quando um usuário **MASTER** estorna a baixa no Financeiro.

```json
{
  "dados": {
    "codigo_acordo": "ACE202611110B4FDFEA",
    "id_parcela": "cob-xxx-p1",
    "titulo_financeiro_id": "uuid",
    "baixa_id": "uuid",
    "motivo_estorno": "texto",
    "estornado_em": "2026-11-16T20:05:00.000Z",
    "valor_liquido_estornado": 202.3,
    "status_titulo": "PARCIAL",
    "saldo_parcela": 202.3
  }
}
```

### `acordo.atualizado`

Enviado **a cada baixa e a cada estorno**, com o estado completo de **todas** as parcelas do acordo (ordenadas por número).

```json
{
  "dados": {
    "codigo_acordo": "ACE202611110B4FDFEA",
    "status_pagamento_financeiro": "PARCIAL",
    "valor_acordado": 923.2,
    "valor_recebido_total": 100,
    "parcelas": [
      {
        "id_parcela": "cob-xxx-entrada",
        "numero": 0,
        "tipo_parcela": "ENTRADA",
        "status": "PAGO",
        "valor_original": 100,
        "valor_recebido": 100,
        "saldo": 0,
        "data_vencimento": "2026-11-11",
        "data_pagamento": "2026-12-10"
      }
    ]
  }
}
```

Valores de `status_pagamento_financeiro` calculados no Financeiro: `QUITADO` | `PARCIAL` | `EM_ABERTO`.

### Idempotência e falhas

- Chave interna: `idempotency_key` (ex.: `{baixa_id}:titulo.baixado`). Reprocessar a mesma baixa não gera segundo POST com payload distinto.
- Falha de envio **não** estorna a baixa no Financeiro.
- Após `COB_RETORNO_MAX_TENTATIVAS` tentativas, o evento fica `FALHOU`. Apenas **MASTER** lista em `GET /v1/integracao/cobranca/retorno/falhas` e pode `POST /v1/integracao/cobranca/retorno/eventos/:id/reenviar`.

---

## Status — tabela de mapeamento (preencher pelo COB)

| Campo Financeiro | Valores possíveis | Significado no Financeiro | Status / ação no COB *(preencher)* |
|------------------|-------------------|---------------------------|-------------------------------------|
| `dados.status_titulo` (parcela) | `ABERTO`, `PARCIAL`, `PAGO`, `VENCIDO`, … | Situação do título após o evento | |
| `dados.status_pagamento_financeiro` | `EM_ABERTO`, `PARCIAL`, `QUITADO` | Agregado do acordo | |
| `dados.parcelas[].status` | idem título | Snapshot por parcela em `acordo.atualizado` | |
| `tipo` do aviso | `titulo.baixado`, `titulo.estornado`, `acordo.atualizado` | Tipo de notificação | |

---

## API de entrada (COB → Financeiro)

Inalterada em rota: `POST /v1/integracao/cobranca/acordos`. A validação HMAC aceita **legado** ou **v2** conforme presença de `X-Timestamp`.

Consulte `ESPECIFICACAO.md` e DTOs em `src/modules/integracao-cobranca/dto/` para o corpo do acordo.