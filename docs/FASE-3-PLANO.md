# Fase 3 — Integração bancária (PRs sequenciais)

| PR | Branch sugerida | Base | Escopo |
|----|-----------------|------|--------|
| **3A** | `cursor/pr-3a-banco-bafb` | `cursor/etapa-b-fase-2-bafb` | `BancoProvider`, Inter saldo/extrato/mock+mTLS, credenciais por env |
| **3B** | `cursor/pr-3b-cobranca-bafb` | 3A | Emissão boleto+Pix, webhook Inter, baixa automática, job consulta |
| **3C** | `cursor/pr-3c-cob-retorno-bafb` | 3B | Webhooks HMAC `titulo.baixado` / `acordo.atualizado` para o COB |

## Credenciais Inter (não vão ao git)

Para `credencial_ref` = `prod-inter-cobranca`:

```env
INTER_USE_MOCK=false
INTER_SANDBOX=true   # ou false em produção
# opcional: INTER_API_BASE_URL=https://cdpj-sandbox.partners.uatinter.co

BANCO_CRED_PROD_INTER_COBRANCA_CLIENT_ID=...
BANCO_CRED_PROD_INTER_COBRANCA_CLIENT_SECRET=...
BANCO_CRED_PROD_INTER_COBRANCA_CERT_PATH=/caminho/seguro/inter.crt
BANCO_CRED_PROD_INTER_COBRANCA_KEY_PATH=/caminho/seguro/inter.key
```

Endpoints usados (documentação developers.inter.co / Banking v2):

- `POST /oauth/v2/token` (mTLS + client credentials)
- `GET /banking/v2/saldo` (`dataSaldo` opcional)
- `GET /banking/v2/extrato` (`dataInicio`, `dataFim`)

Cobrança/webhook/pagamento: **PR 3B** (não inventar paths antes da doc da API de Cobrança).