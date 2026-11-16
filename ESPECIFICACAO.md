# Lexius Financeiro — Especificação Funcional e Técnica

Módulo de gestão financeira completa para o grupo: **Lexius Cobrança**, **empresa de Sistemas** e **Escritório de Advocacia**, integrado ao Lexius COB e ao Banco Inter Empresas (com Asaas durante a transição).

> **Premissas assumidas** (ajuste se necessário): Node.js + TypeScript (NestJS), PostgreSQL, front-end React/Next.js, armazenamento de comprovantes em bucket privado (S3 ou compatível), fila com Redis (BullMQ). O modelo de dados está em `schema.sql`.

---

## 1. Visão geral e arquitetura

```
┌──────────────┐  eventos/API   ┌───────────────────┐   API (mTLS+OAuth2)   ┌──────────────┐
│  Lexius COB  │ ─────────────► │  Lexius Financeiro │ ◄──────────────────► │ Banco Inter  │
│ (acordos,    │ ◄───────────── │  (API + Workers)   │      webhooks         │ Empresas     │
│  boletos)    │  baixa/status  │                   │ ◄──────────────────── │              │
└──────────────┘                └─────────┬─────────┘                       └──────────────┘
                                          │                                  ┌──────────────┐
                                          ├────────────────────────────────► │ Asaas (legado│
                                          │                                  │ até migrar)  │
                                ┌─────────▼─────────┐                       └──────────────┘
                                │ PostgreSQL + S3   │
                                └───────────────────┘
```

**Decisões-chave**

1. **Financeiro é a fonte da verdade do dinheiro.** O Lexius COB continua dono de acordos/devedores; o Financeiro é dono de títulos, baixas, saldos e repasses.
2. **Camada de provedor bancário (adapter).** Interface única `BancoProvider` com implementações `InterProvider`, `AsaasProvider`, `C6Provider` e `ManualProvider`. Trocar Asaas por Inter vira configuração por conta bancária, não reescrita.
3. **Tudo idempotente.** Webhooks, sincronização de extrato e criação de títulos usam chaves únicas (já previstas no schema) para que reprocessar nunca duplique valores.
4. **Multiempresa desde o dia 1.** Toda tabela tem `empresa_id`; usuários têm papel por empresa.
5. **Tudo entra numa única conta Inter Empresas** (decisão do cliente). Como o dinheiro dos credores fica misturado ao da empresa, o sistema controla o que é de terceiros por **razão de repasses**: a view `v_posicao_empresa` mostra *saldo total*, *a repassar aos credores* e *saldo próprio* (total − a repassar). Isso evita gastar dinheiro de credor por engano; o pagamento de despesas alerta quando o valor ultrapassa o saldo próprio.

---

## 2. Módulos e funcionalidades

### 2.1 Contas a Receber
- Lançamento manual de título (valor, vencimento, pessoa, categoria, conta de entrada, centro de custo, observação).
- Parcelamento automático (gera N títulos com `grupo_parcelas_id`) e lançamento recorrente.
- **Categoria/conta de entrada selecionável:** *Recebimento de Cliente*, *Serviços*, *Cobrança Jurídica*, *Comissões e Honorários*, *Outras Receitas* (plano de contas editável, com subcategorias).
- **Criação automática vinda da cobrança:** ao gerar boleto/acordo no Lexius COB, o título nasce no Financeiro (origem `COBRANCA_BOLETO` ou `COBRANCA_ACORDO`), já vinculado ao credor e à parcela do COB.
- **Baixa automática** por webhook do banco (boleto/Pix pago) → baixa no Financeiro → notifica o COB para baixar a parcela/acordo. Fallback: baixa por conciliação do extrato.
- **Baixa manual:** total ou parcial, com data, conta de entrada, forma, juros/multa/desconto/tarifa, anexo de comprovante.
- **Estorno de baixa** com motivo e auditoria (reabre o título, desfaz o movimento e, se já repassado, bloqueia e exige ajuste no repasse).
- Renegociação (cancela títulos e gera novos mantendo histórico), cancelamento, segunda via de boleto, reenvio por e-mail/WhatsApp.
- Cálculo automático de juros e multa por atraso (regra configurável por empresa/credor).
- Filtros: período, status, pessoa, credor, categoria, conta, origem; exportação CSV/XLSX.

### 2.2 Contas a Pagar
- Lançamento manual, parcelado ou recorrente (aluguel, salários, assinaturas).
- **Categorias de despesa selecionáveis:** *Despesas de Escritório*, *Despesas de Sistema*, *Despesas com Advogado*, *Taxas e Impostos*, *Salário de Colaborador*, *Repasse a Credores*, *Tarifas Bancárias*, *Outras*.
- Leitura de código de barras / linha digitável de boleto a pagar; consulta do boleto via API quando o banco permitir.
- Fluxo: **lançar → aprovar → pagar (via API ou baixa manual) → comprovante**.
- Pagamento direto pelo sistema (Pix, boleto, TED) com agendamento.
- Anexos: nota fiscal, contrato, comprovante. As **notas fiscais são emitidas fora do sistema**; aqui só se guarda o número da NF e o arquivo como anexo (sem emissor integrado).
- Folha: lançamento de salários em lote (por colaborador) com pagamento em lote via Pix.

### 2.3 Contas Bancárias
- Cadastro de contas por empresa: **Inter Empresas** (cobrança, via API), **C6** (empresa de sistemas e escritório), Asaas (legado, durante a transição) e caixa/manuais.
- **C6:** começar com extrato por importação OFX/CSV e baixa manual, pagando pelo app do banco e anexando o comprovante. Se o C6 oferecer API para PJ no plano de vocês, ativa-se o `C6Provider` (saldo, extrato, pagamentos) sem mudar o resto do sistema. **Confirme com o gerente do C6 se há API disponível.**
- **Saldo** em tempo real: saldo do banco (API) × saldo calculado pelo sistema, com alerta de divergência.
- **Extrato** sincronizado por API (job periódico + sob demanda), com filtros e exportação; importação OFX para bancos sem API.
- **Pagamentos e transferências:** Pix (chave/QR), boleto, TED, transferência entre contas do grupo, DARF/tributos quando disponível.
- **"Saque":** o Inter não opera saque em espécie por API; na prática o saque é *transferência para outra conta* (própria ou de terceiros). A tela "Solicitar saque" cria uma **solicitação de transferência** com valor, conta de destino e justificativa, que segue o fluxo de aprovação.
- **Comprovante em todo pagamento:** o sistema baixa o comprovante oficial pela API (quando disponível) e permite anexar arquivo manual; fica vinculado ao pagamento/baixa.
- **Conciliação bancária:** cada linha do extrato é casada com baixa/pagamento (automático por valor+data+documento, sugestão para os casos duvidosos, manual para o resto). Tela de pendências.
- **Aprovação:** todo pagamento, transferência/saque e repasse só é enviado ao banco depois de aprovado pelo **usuário MASTER** (qualquer valor). Os demais perfis solicitam; o MASTER aprova ou rejeita com MFA. O MASTER pode aprovar o que ele mesmo lançou, e tudo fica na auditoria.

### 2.4 Repasse a Credores
- **Saldo por credor:** tudo que foi recebido (baixado) e ainda não repassado (`v_saldo_credor`).
- **Cálculo do repasse:** `recebido − comissão − tarifas − outros descontos`.
  - **Comissão = % sobre o valor recebido, informado manualmente** a cada repasse (modo inicial `MANUAL`). O sistema pode sugerir o último % usado para o credor; o modo `FIXO` (percentual padrão por credor) já está previsto no schema para quando quiserem automatizar.
  - **Tarifa do boleto/Pix é descontada do credor:** a tarifa cobrada pelo Inter em cada cobrança paga entra na baixa e é abatida no item do repasse.
  - Honorários advocatícios ficam opcionais (campo existente, zerado por padrão).
- Geração de repasse por período (diário/semanal/quinzenal/mensal) ou manual; seleção de quais baixas entram; cada baixa só pode entrar em um repasse.
- Fluxo: **rascunho → calculado → aprovação → pagamento via Pix/TED → comprovante → status PAGO.**
- Ao pagar, o sistema lança automaticamente: saída da conta de terceiros (repasse) e entrada de comissão/honorários como receita da empresa.
- **Demonstrativo de repasse** em PDF por credor (lista de pagamentos recebidos, devedores, descontos, total) e envio por e-mail. **O portal do credor já existe**: o Financeiro não cria portal, apenas expõe a ele uma API somente-leitura (seção 5) com repasses, demonstrativos em PDF e comprovantes por credor.
- Estorno de baixa já repassada gera **crédito/débito a compensar** no próximo repasse.

### 2.5 Relatórios e indicadores
- Fluxo de caixa realizado e previsto (diário/mensal) por empresa e consolidado.
- DRE gerencial por empresa e centro de custo (receitas por categoria × despesas).
- Inadimplência e aging (a vencer, 1–30, 31–60, 61–90, 90+).
- Recebimentos por credor, por forma de pagamento e por conta.
- Posição de repasses (pendentes, pagos, atrasados).
- Extrato conciliado × não conciliado.
- Dashboard: saldo total, a receber/pagar 7/30 dias, recebido no mês, repasses pendentes, alertas.

### 2.6 Administração e segurança
- Perfis por empresa: **Master** (aprova pagamentos e repasses, acesso total), Admin, Financeiro, Operador, Consulta.
- Autenticação reaproveitando o login do Lexius COB (SSO) + MFA obrigatório para aprovar pagamentos.
- Auditoria completa (quem, quando, antes/depois, IP).
- Fechamento mensal: bloqueia edição/baixa em período fechado.
- Notificações: título vencendo, boleto pago, pagamento falhou, divergência de saldo, repasse a aprovar.

---

### 2.7 Operações entre as empresas do grupo (lançamento espelhado)
- Um lançamento entre empresas (ex.: o escritório cobra serviços da empresa de cobrança) é criado **uma vez** e gera, na mesma transação, um **título a pagar** na empresa devedora e um **título a receber** na empresa credora, ligados em `operacoes_intergrupo`, com origem `INTERGRUPO`, mesmo valor e vencimento.
- Cada lado tem sua própria categoria (ex.: despesa *Despesas com Advogado* de um lado; receita *Serviços* do outro).
- A baixa de um lado sugere a baixa do outro (pagamento entre contas Inter e C6 é conciliado separadamente em cada extrato).
- Cancelar ou alterar o valor afeta os dois lados; só o MASTER pode fazê-lo depois de qualquer baixa.
- Relatório consolidado do grupo **elimina** as operações intergrupo para não inflar receita e despesa.

## 3. Fluxos críticos

### 3.1 Boleto gerado na cobrança → título → baixa automática
1. Operador gera acordo/boleto no Lexius COB.
2. COB chama `POST /v1/titulos-receber/da-cobranca` (ou publica evento) com: acordo, parcela, devedor, credor, valor, vencimento.
3. Financeiro cria o título (idempotente por `cobranca_parcela_id`) e chama o `BancoProvider` da conta configurada para emitir o boleto (+ Pix).
4. Registra em `cobrancas_boleto` (linha digitável, código de barras, PDF, copia-e-cola) e devolve ao COB.
5. Devedor paga → banco envia **webhook** → Financeiro valida assinatura/origem, grava em `webhook_eventos`.
6. Worker processa: cria `baixa` + `movimento_bancario`, marca título PAGO e `cobrancas_boleto` PAGA.
7. Financeiro notifica o COB (`PATCH` ou evento `titulo.baixado`) → COB baixa parcela/acordo.
8. Se o webhook falhar: job de **consulta periódica** das cobranças em aberto + conciliação do extrato corrigem o estado.

#### 3.1.1 Como o acordo do COB vira títulos (baseado na tela "Acordos Realizados")

Exemplo real da tela: acordo `ACE202611110B4FDFEA`, devedor HEMELLY LIMA DOS SANTOS, credor PAIVA & SANTOS LTDA ME, *Parcelado com entrada*, forma **Pix**, original R$ 923,20, desconto 0, entrada R$ 100,00 (11/11/2026) + 4 parcelas de R$ 205,80 (09/12, 09/01, 09/02, 09/03). Conferência: 100,00 + 4 × 205,80 = 923,20.

Mapeamento:
- O acordo vira um registro em `cobranca_acordos` (código, devedor, credor, tipo, forma, valores, status do acordo e do pagamento).
- **Cada linha da tabela "Parcelas" vira um título a receber**: a entrada com `tipo_parcela = ENTRADA` e `parcela_numero = 0`; as demais `PARCELA` 1..N. Esse exemplo gera 5 títulos.
- A **forma de pagamento** do acordo (Pix ou Boleto Bancário) decide o que o banco emite: cobrança Pix (QR/copia-e-cola) ou boleto com Pix.
- Os status do COB (**Ativo / Pendente**) são mantidos pelo COB; o Financeiro devolve o recebido e o saldo por parcela (colunas *Recebido* e *Saldo* da tela).

Contrato de integração (COB → Financeiro), `POST /v1/integracao/cobranca/acordos`, idempotente por `codigo`:
```json
{
  "codigo": "ACE202611110B4FDFEA",
  "tipo": "PARCELADO_COM_ENTRADA",
  "forma_pagamento": "PIX",
  "data_acordo": "2026-10-17",
  "devedor": { "nome": "HEMELLY LIMA DOS SANTOS", "documento": "55565700272" },
  "credor":  { "nome": "PAIVA & SANTOS LTDA ME" },
  "valor_original": 923.20, "desconto": 0, "valor_acordado": 923.20,
  "parcelas": [
    { "id_parcela": "…", "numero": 0, "tipo": "ENTRADA", "valor": 100.00, "vencimento": "2026-11-11" },
    { "id_parcela": "…", "numero": 1, "tipo": "PARCELA", "valor": 205.80, "vencimento": "2026-12-09" }
  ]
}
```
Retorno do Financeiro → COB (webhook/chamada): `titulo.baixado` com `codigo`, `id_parcela`, `valor_recebido`, `data`, `forma`, e `acordo.atualizado` quando a última parcela quita o acordo.

Esse contrato assume que o COB consegue **chamar uma API ou disparar um webhook** ao criar/alterar acordos. Como ele é desenvolvido no GitHub/Cursor, a implementação é um pequeno serviço de saída no próprio COB. Alternativa se preferirem não mexer no COB agora: o Financeiro lê os acordos por consulta periódica (polling) ao banco/API do COB.

### 3.2 Repasse
1. Job (ou usuário) seleciona credor e período → lista baixas não repassadas.
2. Aplica regra do credor → calcula itens (`repasse_itens`) e totais.
3. O usuário MASTER revisa e aprova (MFA).
4. Sistema cria `pagamentos_bancarios` (Pix para os dados bancários padrão do credor), envia ao banco com chave de idempotência.
5. Webhook/consulta confirma efetivação → baixa o repasse, anexa comprovante, lança comissão como receita, gera demonstrativo.

### 3.3 Pagamento de despesa
Título a pagar → (aprovação do MASTER) → pagamento por API ou baixa manual → comprovante anexado → conciliação com extrato.

---

## 4. Integração Banco Inter Empresas

> Os detalhes abaixo refletem o desenho geral da API do Inter. **Confirme endpoints, escopos e campos na documentação oficial (developers.inter.co) antes de implementar**, pois versões mudam.

**Autenticação:** OAuth 2.0 (client credentials) + **certificado digital mTLS** (.crt/.key) gerado na conta PJ. Um aplicativo/credencial por conta bancária. Token de curta duração, renovado automaticamente.

**Escopos tipicamente necessários**
| Funcionalidade | Escopo |
|---|---|
| Saldo e extrato | `extrato.read` |
| Boletos de cobrança (emitir/consultar/cancelar) | `boleto-cobranca.read`, `boleto-cobranca.write` |
| Pix cobrança (QR) | `cob.read`, `cob.write`, `cobv.*`, `pix.read` |
| Pagar boleto/convênio | `pagamento-boleto.read`, `pagamento-boleto.write` |
| Enviar Pix | `pagamento-pix.write` / `pix.write` |
| Webhooks | `webhook.read`, `webhook.write` |

**Capacidades mapeadas no sistema:** consultar saldo; extrato (período); emitir/consultar/cancelar cobrança (boleto com Pix); registrar webhook de cobrança paga; pagar boleto; enviar Pix; consultar status de pagamento; baixar comprovante.

**Boas práticas de implementação**
- Certificados e client secrets **somente em cofre de segredos** (AWS Secrets Manager, Vault, Doppler); no banco só `credencial_ref`.
- Respeitar rate limit; fila com retry exponencial; circuit breaker.
- Webhook em endpoint público HTTPS, validando origem/assinatura quando disponível, respondendo 200 rápido e processando em fila.
- Sincronização de extrato incremental (a partir da última data) usando `id_externo` para deduplicar.
- Ambiente **sandbox** do Inter para desenvolvimento e testes.

### Migração Asaas → Inter
1. Cadastrar conta Inter com `provedor = INTER`; manter Asaas ativo.
2. Novos boletos passam a sair pelo Inter (configuração por conta/empresa); boletos antigos continuam no Asaas e seus webhooks seguem sendo processados (`cobrancas_boleto.provedor`).
3. Rodar em paralelo até esgotar boletos em aberto no Asaas; então desativar a conta.
4. Atualizar os dados bancários exibidos ao devedor e avisar credores sobre a nova conta de recebimento.

---

## 5. Endpoints principais (REST, prefixo `/v1`)

| Área | Endpoints |
|---|---|
| Empresas/contas | `GET/POST /empresas`, `GET/POST /contas-bancarias`, `GET /contas-bancarias/:id/saldo`, `GET /contas-bancarias/:id/extrato?de=&ate=`, `POST /contas-bancarias/:id/sincronizar` |
| Receber | `GET/POST /titulos-receber`, `POST /titulos-receber/da-cobranca`, `POST /titulos-receber/:id/baixar`, `POST /titulos-receber/:id/cancelar`, `POST /titulos-receber/:id/emitir-boleto`, `POST /baixas/:id/estornar` |
| Pagar | `GET/POST /titulos-pagar`, `POST /titulos-pagar/:id/aprovar`, `POST /titulos-pagar/:id/pagar`, `POST /titulos-pagar/:id/baixar` |
| Pagamentos | `POST /pagamentos` (pix/boleto/ted/saque), `POST /pagamentos/:id/aprovar`, `POST /pagamentos/:id/rejeitar`, `GET /pagamentos/:id/comprovante` |
| Repasses | `GET /credores/:id/saldo`, `POST /repasses/gerar`, `POST /repasses/:id/aprovar`, `POST /repasses/:id/pagar`, `GET /repasses/:id/demonstrativo.pdf` |
| Conciliação | `GET /conciliacao/pendentes`, `POST /conciliacao/conciliar`, `POST /conciliacao/auto` |
| Anexos | `POST /anexos` (multipart), `GET /anexos/:id/download` (URL assinada) |
| Portal do credor (somente leitura) | `GET /portal/credores/:id/repasses`, `GET /portal/repasses/:id/demonstrativo.pdf`, `GET /portal/credores/:id/recebimentos` (chave de serviço do portal; sempre filtrada pelo credor) |
| Intergrupo | `POST /intergrupo` (cria os dois títulos), `GET /intergrupo`, `POST /intergrupo/:id/cancelar` |
| Relatórios | `GET /relatorios/fluxo-caixa`, `/dre`, `/inadimplencia`, `/repasses` |
| Webhooks | `POST /webhooks/inter`, `POST /webhooks/asaas` |
| Integração COB | autenticação por chave de serviço + assinatura HMAC no corpo |

---

## 6. Telas (front-end)

Mesmo padrão visual do Lexius COB (menu lateral azul, cards de indicadores, filtros no topo, tabela com ações). Novo grupo de menu **Financeiro** com:

1. **Dashboard financeiro** — saldos, a receber/pagar, fluxo de caixa, alertas.
2. **Contas a Receber** — lista + modal de lançamento + modal de baixa.
3. **Contas a Pagar** — lista + lançamento + aprovação + pagamento.
4. **Contas Bancárias** — cards de saldo por conta; abas *Extrato*, *Pagamentos*, *Transferências/Saque*, *Conciliação*.
5. **Repasses** — saldo por credor, geração, aprovação, histórico, demonstrativo.
6. **Plano de contas e centros de custo.**
7. **Relatórios.**
8. **Configurações** — empresas, provedores bancários, regras de repasse, usuários.

---

## 7. Segurança e conformidade

- **Segredos:** nunca em repositório/banco; cofre + rotação de certificados (monitorar validade do certificado do Inter).
- **Autorização:** RBAC por empresa; somente o MASTER aprova pagamentos; MFA obrigatório para aprovar; auditoria de toda aprovação.
- **Idempotência de pagamento:** `chave_idempotencia` evita pagar duas vezes em caso de retry.
- **Auditoria imutável** de ações financeiras; logs sem dados sensíveis.
- **LGPD:** minimização de dados do devedor, base legal registrada, política de retenção, acesso aos anexos apenas por URL assinada e temporária.
- **Backup** diário com teste de restauração; criptografia em repouso e em trânsito.
- **Aspecto regulatório de repasse:** valores de credores devem transitar em conta segregada e ser rastreáveis; **valide com seu contador/jurídico** o tratamento fiscal e contábil de repasses, comissões e honorários entre as três empresas (inclusive operações entre empresas do grupo).

---

## 8. Roadmap sugerido

| Fase | Entrega | Resultado |
|---|---|---|
| **1 — Fundação** (3–4 sem.) | Multiempresa, usuários/papéis, plano de contas, pessoas, contas bancárias manuais | Base pronta |
| **2 — Receber/Pagar** (4–5 sem.) | Títulos, baixa manual, parcelamento, recorrência, anexos, relatórios básicos | Financeiro utilizável sem banco |
| **3 — Integração COB + Inter** (4–6 sem.) | Provider Inter, emissão de boleto, webhook, baixa automática nos dois sistemas, sincronização de extrato/saldo | Automação central |
| **4 — Repasses** (3–4 sem.) | Regras por credor, cálculo, aprovação, pagamento Pix, demonstrativo | Operação da cobrança fechada |
| **5 — Pagamentos e conciliação** (3–4 sem.) | Pix/boleto/TED por API, saque/transferência, comprovantes, conciliação | Tesouraria completa |
| **6 — Inteligência** (contínuo) | DRE, fluxo previsto, portal do credor, alertas, importação OFX/C6 | Gestão avançada |

---

## 9. Decisões tomadas e pontos em aberto

**Decididas**
1. Valores dos credores entram na **mesma conta Inter Empresas** da cobrança; controle por razão de repasses (seção 1, item 5).
2. **Comissão:** % sobre o valor recebido, **manual** por enquanto.
3. **Tarifa do boleto:** descontada do credor.
4. **Integração com o COB:** o COB **chama a API do Financeiro** (seção 3.1.1); sem consulta periódica ao COB.
5. **Aprovações:** somente o usuário MASTER, sem faixas de valor.
6. **Nota fiscal:** emitida fora do sistema; só referência e anexo.
7. **Operações entre as três empresas:** **espelhadas** (seção 2.7).
8. **Portal do credor:** já existe; o Financeiro fornece a API de leitura.
9. **Bancos:** Inter Empresas (cobrança) e **C6** (sistemas e escritório).

**Ainda em aberto**
Nenhum ponto em aberto bloqueia o início do desenvolvimento.
