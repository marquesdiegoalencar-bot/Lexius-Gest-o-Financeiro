# Fase 4 — Repasses a credores

| PR | Branch | Escopo |
|----|--------|--------|
| **4A** | `cursor/fase-4-repasses-4a-bafb` | Saldo, rascunho, cálculo (fórmula corrigida), regras credor |
| **4B** | (futuro) | Aprovação MASTER, Pix async, comissão 1.04 sem movimento, pagar fora |
| **4C** | (futuro) | PDF + portal leitura |
| **4D** | (futuro) | `repasse_ajustes`, HMAC legado COB |

## Fórmula de cálculo (4A)

- **Base (bruto)** por baixa: `valor_liquido + tarifa`
- **Comissão:** `%` sobre o **bruto** (digitado a cada repasse)
- **Repasse líquido ao credor (item):** `bruto − comissão − honorários − tarifa`
- **Cabeçalho:** `total_repasse = Σ itens.valor_repasse − outros_descontos`
- **`v_saldo_credor`:** continua `SUM(valor_liquido)` (líquido pendente)

Referência: bruto 100,00, tarifa 0,90, comissão 10% → repasse **89,10**.

## Estorno após repasse pago (4D — previsto)

- Somente **MASTER**; cria `repasse_ajustes` (sem apagar histórico do repasse pago).
- **Comissão:** ajuste credita à empresa o valor de comissão proporcional estornado (reversão lógica do título 1.04).
- **Tarifa:** tarifa já foi descontada do credor no repasse original; no estorno a baixa reabre o título — o ajuste no próximo repasse compensa o **valor_repasse** líquido que foi pago ao credor, detalhado no demonstrativo.

## Bloqueios antes de produção

- MFA na aprovação de repasse/pagamento (gancho `REPASSE_EXIGE_MFA`, implementação pendente).

## API 4A

- `GET /v1/credores/:id/saldo-repasse`
- `GET /v1/credores/:id/baixas-pendentes-repasse`
- `GET|PUT /v1/credores/:id/regras-repasse`
- `POST /v1/repasses/gerar`, `POST /v1/repasses/:id/calcular`
- `GET /v1/repasses`, `GET /v1/repasses/:id`