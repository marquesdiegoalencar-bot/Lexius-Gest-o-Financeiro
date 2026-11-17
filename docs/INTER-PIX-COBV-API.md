# Inter — Pix cobv (referência de paths e escopos)

Fonte primária: [developers.inter.co](https://developers.inter.co/) (OpenAPI).  
Espelho auxiliar: conector documentado na Abstra (`pix/*_by_txid`), alinhado ao padrão Pix v2 BACEN.

| Operação | Método + path | Escopo OAuth | Confirmação portal |
|----------|---------------|--------------|-------------------|
| Criar cobv | `PUT /pix/v2/cobv/{txid}` | `cobv.write` | Abstra + SDKs oficiais Inter; **HTML do portal não expandiu CobV nesta sessão** |
| Revisar cobv | `PATCH /pix/v2/cobv/{txid}` | `cobv.write` | Abstra |
| Consultar cobv | `GET /pix/v2/cobv/{txid}` | `cobv.read` | Abstra |
| Listar cobv | `GET /pix/v2/cobv?inicio&fim&…` | `cobv.read` | Abstra |
| Sandbox pagar | `POST /pix/v2/cobv/{txid}/pagamento` | `pix.write` | Abstra (`post_cobv_pagar_by_txid`) |
| Cadastrar webhook Pix | `PUT /pix/v2/webhook/{chave}` body `{ "webhookUrl" }` | `webhook.write` | Abstra + Ruby `inter_api` `/pix/v2/webhook/{chave}` |
| Consultar webhook | `GET /pix/v2/webhook/{chave}` | `webhook.read` | Abstra |
| Remover webhook | `DELETE /pix/v2/webhook/{chave}` | `webhook.write` | Abstra |

**Callback:** mesma validação mTLS do [callback webhook](https://developers.inter.co/docs/webhooks/callback-webhook) (3B).

**GET cobv — pagamento (padrão BACEN Pix v2, usado pelo mapper):**

- `status`: `CONCLUIDA` indica quitação.
- `pix[]`: cada recebimento com `endToEndId`, `valor` (string decimal), `horario`, opcional `componentesValor` (`original`, `juros`, `multa`, `desconto` / `abatimento`).
- **Não calcular** encargos por fórmula local: usar apenas estes campos.

**Expiração:** `calendario.dataDeVencimento` + `calendario.validadeAposVencimento` (dias). Após o prazo, cobv não paga → `EXPIRADA` no Lexius.

**Chave Pix:** cadastro no Internet Banking; não há API de “criar chave”. Campo `chave_pix` em `contas_bancarias`.