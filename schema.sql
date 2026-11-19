-- =====================================================================
-- LEXIUS FINANCEIRO - Modelo de dados (PostgreSQL 15+)
-- Multiempresa: Cobrança, Sistemas, Advocacia
-- Valores monetários em NUMERIC(14,2). Datas de vencimento em DATE,
-- eventos em TIMESTAMPTZ.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- busca por nome

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
CREATE TYPE tipo_empresa        AS ENUM ('COBRANCA','SISTEMAS','ADVOCACIA','OUTRA');
CREATE TYPE provedor_bancario   AS ENUM ('INTER','ASAAS','C6','MANUAL','OUTRO');
CREATE TYPE tipo_conta_bancaria AS ENUM ('CORRENTE','POUPANCA','PAGAMENTO','CAIXA','CARTAO');
CREATE TYPE natureza            AS ENUM ('RECEITA','DESPESA');
CREATE TYPE status_titulo       AS ENUM ('ABERTO','PARCIAL','PAGO','VENCIDO','CANCELADO','RENEGOCIADO');
CREATE TYPE forma_pagamento     AS ENUM ('BOLETO','PIX','TED','DOC','DINHEIRO','CARTAO','TRANSFERENCIA','DEBITO_AUTOMATICO','OUTRO');
CREATE TYPE origem_titulo       AS ENUM ('MANUAL','COBRANCA_BOLETO','COBRANCA_ACORDO','RECORRENCIA','IMPORTACAO','REPASSE','INTERGRUPO');
CREATE TYPE sentido_movimento   AS ENUM ('CREDITO','DEBITO');
CREATE TYPE origem_movimento    AS ENUM ('API_BANCO','OFX','MANUAL','BAIXA','TRANSFERENCIA','REPASSE','AJUSTE');
CREATE TYPE status_cobranca     AS ENUM ('EMITIDA','REGISTRADA','PAGA','VENCIDA','CANCELADA','EXPIRADA','ERRO');
CREATE TYPE modalidade_cobranca AS ENUM ('COBRANCA_V3','PIX_COBV');
CREATE TYPE tipo_pagamento_bancario AS ENUM ('PIX','BOLETO','TED','TRANSFERENCIA_INTERNA','DARF','SAQUE');
CREATE TYPE status_pagamento_bancario AS ENUM ('RASCUNHO','AGUARDANDO_APROVACAO','APROVADO','REJEITADO','ENVIADO','AGENDADO','EFETIVADO','FALHOU','CANCELADO');
CREATE TYPE status_repasse      AS ENUM ('RASCUNHO','CALCULADO','AGUARDANDO_APROVACAO','APROVADO','PAGO','CANCELADO');
CREATE TYPE tipo_pessoa         AS ENUM ('FISICA','JURIDICA');
CREATE TYPE papel_usuario       AS ENUM ('MASTER','ADMIN','FINANCEIRO','OPERADOR','CONSULTA');

-- ---------------------------------------------------------------------
-- EMPRESAS, USUÁRIOS E PERMISSÕES
-- ---------------------------------------------------------------------
CREATE TABLE empresas (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo          tipo_empresa NOT NULL,
    razao_social  TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj          VARCHAR(14) NOT NULL UNIQUE,
    ativa         BOOLEAN NOT NULL DEFAULT TRUE,
    criada_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usuarios (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    senha_hash    TEXT,                      -- auth local (Fase 1); SSO COB substitui depois
    cobranca_user_id TEXT,                 -- vínculo com usuário do Lexius COB (SSO)
    mfa_ativo     BOOLEAN NOT NULL DEFAULT FALSE,
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usuario_empresa (
    usuario_id    UUID NOT NULL REFERENCES usuarios(id),
    empresa_id    UUID NOT NULL REFERENCES empresas(id),
    papel         papel_usuario NOT NULL,
    -- Aprovação de pagamentos/repasses: somente o papel MASTER (sem faixas de valor por enquanto).
    PRIMARY KEY (usuario_id, empresa_id)
);

CREATE TABLE senha_reset_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash    TEXT NOT NULL,
    expira_em     TIMESTAMPTZ NOT NULL,
    usado_em      TIMESTAMPTZ,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_senha_reset_tokens_usuario ON senha_reset_tokens (usuario_id);
CREATE INDEX idx_senha_reset_tokens_hash ON senha_reset_tokens (token_hash);

-- ---------------------------------------------------------------------
-- PESSOAS (clientes, fornecedores, credores, colaboradores, advogados)
-- ---------------------------------------------------------------------
CREATE TABLE pessoas (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_pessoa   tipo_pessoa NOT NULL,
    nome          TEXT NOT NULL,
    documento     VARCHAR(14),              -- CPF ou CNPJ, só dígitos
    email         TEXT,
    telefone      TEXT,
    eh_cliente    BOOLEAN NOT NULL DEFAULT FALSE,
    eh_fornecedor BOOLEAN NOT NULL DEFAULT FALSE,
    eh_credor     BOOLEAN NOT NULL DEFAULT FALSE,
    eh_colaborador BOOLEAN NOT NULL DEFAULT FALSE,
    eh_advogado   BOOLEAN NOT NULL DEFAULT FALSE,
    cobranca_ref_id TEXT,                   -- id da pessoa/credor no Lexius COB
    criada_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pessoas_documento ON pessoas(documento);
CREATE INDEX idx_pessoas_nome_trgm ON pessoas USING gin (nome gin_trgm_ops);

CREATE TABLE pessoa_dados_bancarios (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pessoa_id     UUID NOT NULL REFERENCES pessoas(id),
    banco_codigo  VARCHAR(3),
    agencia       TEXT,
    conta         TEXT,
    tipo_conta    tipo_conta_bancaria,
    titular_nome  TEXT NOT NULL,
    titular_documento VARCHAR(14) NOT NULL,
    chave_pix     TEXT,
    tipo_chave_pix TEXT,                    -- CPF, CNPJ, EMAIL, TELEFONE, ALEATORIA
    padrao        BOOLEAN NOT NULL DEFAULT FALSE,
    ativo         BOOLEAN NOT NULL DEFAULT TRUE
);

-- Regras de repasse por credor
CREATE TABLE credor_regras_repasse (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID NOT NULL REFERENCES empresas(id),   -- empresa de cobrança
    credor_id     UUID NOT NULL REFERENCES pessoas(id),
    comissao_modo TEXT NOT NULL DEFAULT 'MANUAL' CHECK (comissao_modo IN ('MANUAL','FIXO')),
        -- MANUAL: % informado a cada repasse (modo inicial). FIXO: usa o % abaixo como sugestão/padrão.
    percentual_comissao NUMERIC(5,2) NOT NULL DEFAULT 0,   -- % sobre o RECEBIDO, retido pela empresa
    percentual_honorarios NUMERIC(5,2) NOT NULL DEFAULT 0, -- honorários advocatícios, se houver
    descontar_taxa_boleto BOOLEAN NOT NULL DEFAULT TRUE,   -- tarifa do boleto/Pix é descontada do credor
    descontar_taxa_bancaria BOOLEAN NOT NULL DEFAULT TRUE,
    periodicidade TEXT NOT NULL DEFAULT 'SEMANAL',         -- DIARIO, SEMANAL, QUINZENAL, MENSAL, MANUAL
    dia_repasse   SMALLINT,
    valor_minimo  NUMERIC(14,2) NOT NULL DEFAULT 0,
    vigente_desde DATE NOT NULL DEFAULT CURRENT_DATE,
    vigente_ate   DATE,
    UNIQUE (empresa_id, credor_id, vigente_desde)
);

-- ---------------------------------------------------------------------
-- CONTAS BANCÁRIAS
-- ---------------------------------------------------------------------
CREATE TABLE contas_bancarias (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID NOT NULL REFERENCES empresas(id),
    apelido       TEXT NOT NULL,
    banco_codigo  VARCHAR(3) NOT NULL,        -- 077 = Inter
    agencia       TEXT,
    conta         TEXT,
    tipo          tipo_conta_bancaria NOT NULL DEFAULT 'CORRENTE',
    provedor      provedor_bancario NOT NULL DEFAULT 'MANUAL',
    conta_de_terceiros BOOLEAN NOT NULL DEFAULT FALSE,  -- opcional; hoje tudo entra na mesma conta Inter, então fica FALSE
                                                        -- e o valor dos credores é controlado em v_posicao_conta
    saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
    data_saldo_inicial DATE NOT NULL DEFAULT CURRENT_DATE,
    saldo_banco   NUMERIC(14,2),              -- último saldo lido da API
    saldo_banco_em TIMESTAMPTZ,
    credencial_ref TEXT,                      -- referência no cofre de segredos (NUNCA a credencial em si)
    chave_pix     TEXT,                       -- chave receptora Pix (cadastrada no IBPJ; obrigatória p/ cobv)
    tipo_chave_pix TEXT,                      -- CPF, CNPJ, EMAIL, TELEFONE, ALEATORIA
    sincroniza_extrato BOOLEAN NOT NULL DEFAULT FALSE,
    ultima_sincronizacao TIMESTAMPTZ,
    ativa         BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (empresa_id, banco_codigo, agencia, conta)
);

-- ---------------------------------------------------------------------
-- PLANO DE CONTAS (categorias) E CENTROS DE CUSTO
-- ---------------------------------------------------------------------
CREATE TABLE categorias (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID REFERENCES empresas(id),  -- NULL = categoria global
    pai_id        UUID REFERENCES categorias(id),
    codigo        TEXT,                          -- ex.: 1.01.001
    nome          TEXT NOT NULL,
    natureza      natureza NOT NULL,
    ativa         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TYPE tipo_centro_custo AS ENUM ('ENTRADA', 'SAIDA');
CREATE TYPE tipo_no_centro_custo AS ENUM ('GRUPO', 'SUBGRUPO', 'ANALITICO');

CREATE TABLE centros_custo (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID NOT NULL REFERENCES empresas(id),
    codigo        VARCHAR(32),
    nome          TEXT NOT NULL,
    descricao     TEXT,
    tipo          tipo_centro_custo NOT NULL DEFAULT 'ENTRADA',
    pai_id        UUID REFERENCES centros_custo(id),
    tipo_no       tipo_no_centro_custo NOT NULL,
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (empresa_id, codigo)
);

-- ---------------------------------------------------------------------
-- ACORDOS DO LEXIUS COB (cópia somente-leitura, alimentada pelo COB)
-- Espelha a tela "Acordos Realizados": código, devedor, credor, condições.
-- ---------------------------------------------------------------------
CREATE TABLE cobranca_acordos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID NOT NULL REFERENCES empresas(id),
    codigo        TEXT NOT NULL,                 -- ex.: ACE202611110B4FDFEA
    devedor_id    UUID NOT NULL REFERENCES pessoas(id),
    credor_id     UUID NOT NULL REFERENCES pessoas(id),
    tipo          TEXT NOT NULL,                 -- 'A_VISTA','PARCELADO','PARCELADO_COM_ENTRADA'
    forma_pagamento forma_pagamento NOT NULL,    -- PIX ou BOLETO
    valor_original NUMERIC(14,2) NOT NULL,
    valor_acordado NUMERIC(14,2) NOT NULL,
    desconto       NUMERIC(14,2) NOT NULL DEFAULT 0,
    valor_entrada  NUMERIC(14,2) NOT NULL DEFAULT 0,
    qtd_parcelas   SMALLINT NOT NULL DEFAULT 1,  -- sem contar a entrada
    data_acordo    DATE NOT NULL,
    primeiro_vencimento DATE,
    status_acordo  TEXT NOT NULL DEFAULT 'ATIVO',    -- ATIVO, QUITADO, QUEBRADO, CANCELADO
    status_pagamento TEXT NOT NULL DEFAULT 'PENDENTE', -- PENDENTE, PARCIAL, PAGO
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, codigo),
    CHECK (valor_acordado = valor_original - desconto)
);

-- ---------------------------------------------------------------------
-- TÍTULOS A RECEBER
-- ---------------------------------------------------------------------
CREATE TABLE titulos_receber (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID NOT NULL REFERENCES empresas(id),
    numero        TEXT,
    descricao     TEXT NOT NULL,
    pessoa_id     UUID REFERENCES pessoas(id),           -- quem paga (devedor/cliente)
    credor_id     UUID REFERENCES pessoas(id),           -- credor dono do crédito (cobrança)
    categoria_id  UUID NOT NULL REFERENCES categorias(id),  -- Recebimento Cliente / Serviços / Cobrança Jurídica...
    centro_custo_id UUID REFERENCES centros_custo(id),
    conta_bancaria_id UUID REFERENCES contas_bancarias(id), -- conta de entrada prevista
    origem        origem_titulo NOT NULL DEFAULT 'MANUAL',
    -- vínculo com o sistema de cobrança
    acordo_id            UUID REFERENCES cobranca_acordos(id),
    cobranca_acordo_id   TEXT,                 -- código do acordo no COB
    cobranca_parcela_id  TEXT,                 -- id da parcela no COB (chave de idempotência)
    tipo_parcela   TEXT NOT NULL DEFAULT 'AVULSO' CHECK (tipo_parcela IN ('ENTRADA','PARCELA','AVULSO')),
    parcela_numero SMALLINT NOT NULL DEFAULT 1,  -- entrada = 0; parcelas 1..N
    parcela_total  SMALLINT NOT NULL DEFAULT 1,
    grupo_parcelas_id UUID,
    valor_original NUMERIC(14,2) NOT NULL CHECK (valor_original > 0),
    desconto       NUMERIC(14,2) NOT NULL DEFAULT 0,
    juros          NUMERIC(14,2) NOT NULL DEFAULT 0,
    multa          NUMERIC(14,2) NOT NULL DEFAULT 0,
    valor_recebido NUMERIC(14,2) NOT NULL DEFAULT 0,
    data_emissao   DATE NOT NULL DEFAULT CURRENT_DATE,
    data_vencimento DATE NOT NULL,
    data_competencia DATE,
    data_pagamento DATE,
    status         status_titulo NOT NULL DEFAULT 'ABERTO',
    forma_prevista forma_pagamento,
    observacao     TEXT,
    criado_por     UUID REFERENCES usuarios(id),
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- idempotência: a mesma parcela do COB nunca gera dois títulos
    UNIQUE (empresa_id, cobranca_parcela_id)
);
CREATE INDEX idx_tr_venc    ON titulos_receber(empresa_id, status, data_vencimento);
CREATE INDEX idx_tr_pessoa  ON titulos_receber(pessoa_id);
CREATE INDEX idx_tr_credor  ON titulos_receber(credor_id);

-- ---------------------------------------------------------------------
-- TÍTULOS A PAGAR
-- ---------------------------------------------------------------------
CREATE TABLE titulos_pagar (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID NOT NULL REFERENCES empresas(id),
    numero        TEXT,
    descricao     TEXT NOT NULL,
    fornecedor_id UUID REFERENCES pessoas(id),            -- fornecedor, advogado, colaborador, órgão
    categoria_id  UUID NOT NULL REFERENCES categorias(id),   -- Despesas escritório / sistema / advogado / taxas e impostos / salário / outros
    centro_custo_id UUID REFERENCES centros_custo(id),
    conta_bancaria_id UUID REFERENCES contas_bancarias(id),  -- conta de saída prevista
    origem        origem_titulo NOT NULL DEFAULT 'MANUAL',
    recorrencia_id UUID,
    parcela_numero SMALLINT NOT NULL DEFAULT 1,
    parcela_total  SMALLINT NOT NULL DEFAULT 1,
    grupo_parcelas_id UUID,
    valor_original NUMERIC(14,2) NOT NULL CHECK (valor_original > 0),
    desconto       NUMERIC(14,2) NOT NULL DEFAULT 0,
    juros          NUMERIC(14,2) NOT NULL DEFAULT 0,
    multa          NUMERIC(14,2) NOT NULL DEFAULT 0,
    valor_pago     NUMERIC(14,2) NOT NULL DEFAULT 0,
    data_emissao   DATE NOT NULL DEFAULT CURRENT_DATE,
    data_vencimento DATE NOT NULL,
    data_competencia DATE,
    data_pagamento DATE,
    status         status_titulo NOT NULL DEFAULT 'ABERTO',
    forma_prevista forma_pagamento,
    codigo_barras  TEXT,                                  -- boleto a pagar
    chave_pix      TEXT,
    observacao     TEXT,
    numero_nf      TEXT,                                  -- referência da NF emitida fora do sistema (só informativo)
    status_aprovacao TEXT NOT NULL DEFAULT 'PENDENTE'
        CHECK (status_aprovacao IN ('PENDENTE','APROVADO','REJEITADO')),
    aprovado_por   UUID REFERENCES usuarios(id),
    aprovado_em    TIMESTAMPTZ,
    rejeitado_motivo TEXT,
    criado_por     UUID REFERENCES usuarios(id),
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tp_venc ON titulos_pagar(empresa_id, status, data_vencimento);

CREATE TABLE recorrencias (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID NOT NULL REFERENCES empresas(id),
    natureza      natureza NOT NULL,
    descricao     TEXT NOT NULL,
    pessoa_id     UUID REFERENCES pessoas(id),
    categoria_id  UUID NOT NULL REFERENCES categorias(id),
    conta_bancaria_id UUID REFERENCES contas_bancarias(id),
    valor         NUMERIC(14,2) NOT NULL,
    frequencia    TEXT NOT NULL,                          -- MENSAL, SEMANAL, ANUAL...
    dia_vencimento SMALLINT,
    inicio        DATE NOT NULL,
    fim           DATE,
    gerar_antecedencia_dias SMALLINT NOT NULL DEFAULT 30,
    ativa         BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------
-- LANÇAMENTOS ESPELHADOS ENTRE AS EMPRESAS DO GRUPO
-- Uma operação entre empresas (ex.: escritório cobra da empresa de cobrança)
-- gera um título A PAGAR na empresa devedora e um A RECEBER na credora,
-- sempre juntos e com o mesmo valor/vencimento.
-- ---------------------------------------------------------------------
CREATE TABLE operacoes_intergrupo (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    descricao       TEXT NOT NULL,
    empresa_credora_id UUID NOT NULL REFERENCES empresas(id),   -- quem recebe
    empresa_devedora_id UUID NOT NULL REFERENCES empresas(id),  -- quem paga
    titulo_receber_id UUID UNIQUE REFERENCES titulos_receber(id),
    titulo_pagar_id   UUID UNIQUE REFERENCES titulos_pagar(id),
    valor           NUMERIC(14,2) NOT NULL CHECK (valor > 0),
    data_vencimento DATE NOT NULL,
    criada_por      UUID REFERENCES usuarios(id),
    criada_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (empresa_credora_id <> empresa_devedora_id)
);

-- ---------------------------------------------------------------------
-- MOVIMENTOS BANCÁRIOS (livro-razão por conta; extrato do sistema)
-- ---------------------------------------------------------------------
CREATE TABLE movimentos_bancarios (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_bancaria_id UUID NOT NULL REFERENCES contas_bancarias(id),
    data_movimento DATE NOT NULL,
    data_hora     TIMESTAMPTZ,
    sentido       sentido_movimento NOT NULL,
    valor         NUMERIC(14,2) NOT NULL CHECK (valor > 0),
    descricao     TEXT,
    contraparte_nome TEXT,
    contraparte_documento VARCHAR(14),
    tipo_transacao TEXT,                    -- PIX, BOLETO, TED, TARIFA, RENDIMENTO...
    origem        origem_movimento NOT NULL,
    id_externo    TEXT,                     -- id do lançamento no banco (evita duplicar na sincronização)
    saldo_apos    NUMERIC(14,2),
    conciliado    BOOLEAN NOT NULL DEFAULT FALSE,
    conciliado_em TIMESTAMPTZ,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conta_bancaria_id, id_externo)
);
CREATE INDEX idx_mov_conta_data ON movimentos_bancarios(conta_bancaria_id, data_movimento);
CREATE INDEX idx_mov_conc ON movimentos_bancarios(conta_bancaria_id, conciliado);

-- ---------------------------------------------------------------------
-- BAIXAS (liquidações de títulos, parciais ou totais, manuais ou automáticas)
-- ---------------------------------------------------------------------
CREATE TABLE baixas (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID NOT NULL REFERENCES empresas(id),
    titulo_receber_id UUID REFERENCES titulos_receber(id),
    titulo_pagar_id   UUID REFERENCES titulos_pagar(id),
    conta_bancaria_id UUID NOT NULL REFERENCES contas_bancarias(id),
    movimento_id  UUID REFERENCES movimentos_bancarios(id),
    movimento_tarifa_id UUID REFERENCES movimentos_bancarios(id),
    data_baixa    DATE NOT NULL,
    valor_principal NUMERIC(14,2) NOT NULL CHECK (valor_principal >= 0),
    juros         NUMERIC(14,2) NOT NULL DEFAULT 0,
    multa         NUMERIC(14,2) NOT NULL DEFAULT 0,
    desconto      NUMERIC(14,2) NOT NULL DEFAULT 0,
    tarifa        NUMERIC(14,2) NOT NULL DEFAULT 0,   -- tarifa do banco/boleto
    valor_liquido NUMERIC(14,2) NOT NULL,
    forma         forma_pagamento NOT NULL,
    automatica    BOOLEAN NOT NULL DEFAULT FALSE,     -- TRUE = veio de webhook/conciliação
    origem_evento_id UUID,                            -- webhook_eventos.id
    observacao    TEXT,
    estornada     BOOLEAN NOT NULL DEFAULT FALSE,
    estornada_em  TIMESTAMPTZ,
    estornada_por UUID REFERENCES usuarios(id),
    motivo_estorno TEXT,
    criada_por    UUID REFERENCES usuarios(id),
    criada_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ( (titulo_receber_id IS NOT NULL)::int + (titulo_pagar_id IS NOT NULL)::int = 1 )
);
CREATE INDEX idx_baixas_tr ON baixas(titulo_receber_id);
CREATE INDEX idx_baixas_tp ON baixas(titulo_pagar_id);

-- ---------------------------------------------------------------------
-- COBRANÇAS EMITIDAS NO BANCO (boleto / boleto+Pix / Pix)
-- ---------------------------------------------------------------------
CREATE TABLE cobrancas_boleto (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID NOT NULL REFERENCES empresas(id),
    titulo_receber_id UUID NOT NULL REFERENCES titulos_receber(id),
    conta_bancaria_id UUID NOT NULL REFERENCES contas_bancarias(id),
    provedor      provedor_bancario NOT NULL,         -- ASAAS (legado) ou INTER
    modalidade    modalidade_cobranca NOT NULL DEFAULT 'COBRANCA_V3',
    id_externo    TEXT,                               -- codigoSolicitacao (v3) ou txid (cobv)
    nosso_numero  TEXT,
    linha_digitavel TEXT,
    codigo_barras TEXT,
    pix_copia_cola TEXT,
    txid          TEXT,
    url_pdf       TEXT,
    valor         NUMERIC(14,2) NOT NULL,
    data_vencimento DATE NOT NULL,
    status        status_cobranca NOT NULL DEFAULT 'EMITIDA',
    pago_em       TIMESTAMPTZ,
    valor_pago    NUMERIC(14,2),
    erro_mensagem TEXT,
    criada_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provedor, id_externo)
);
CREATE INDEX idx_cb_titulo ON cobrancas_boleto(titulo_receber_id);
CREATE INDEX idx_cobrancas_modalidade_status ON cobrancas_boleto(modalidade, status);

-- Emissão de cobrança pendente (falha no lote / job de reemissão)
CREATE TABLE cobranca_emissao_pendente (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id         UUID NOT NULL REFERENCES empresas(id),
    titulo_receber_id  UUID NOT NULL REFERENCES titulos_receber(id) ON DELETE CASCADE,
    conta_bancaria_id  UUID REFERENCES contas_bancarias(id),
    modalidade         modalidade_cobranca NOT NULL DEFAULT 'PIX_COBV',
    ultimo_erro        TEXT NOT NULL,
    tentativas         SMALLINT NOT NULL DEFAULT 0,
    criada_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolvida_em       TIMESTAMPTZ,
    UNIQUE (titulo_receber_id, modalidade)
);
CREATE INDEX idx_emissao_pendente_aberta ON cobranca_emissao_pendente (resolvida_em) WHERE resolvida_em IS NULL;

-- Tarifa de cobrança por conta e forma (boleto / Pix)
CREATE TABLE conta_tarifas_cobranca (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_bancaria_id UUID NOT NULL REFERENCES contas_bancarias(id) ON DELETE CASCADE,
    forma             forma_pagamento NOT NULL,
    valor_tarifa      NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor_tarifa >= 0),
    UNIQUE (conta_bancaria_id, forma)
);

-- Eventos recebidos de webhook (idempotência + auditoria + reprocessamento)
CREATE TABLE webhook_eventos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provedor      provedor_bancario NOT NULL,
    evento_id_externo TEXT,
    tipo_evento   TEXT NOT NULL,
    payload       JSONB NOT NULL,
    assinatura_valida BOOLEAN,
    processado    BOOLEAN NOT NULL DEFAULT FALSE,
    processado_em TIMESTAMPTZ,
    tentativas    SMALLINT NOT NULL DEFAULT 0,
    erro          TEXT,
    revisao_manual BOOLEAN NOT NULL DEFAULT FALSE,
    recebido_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provedor, evento_id_externo)
);

-- ---------------------------------------------------------------------
-- PAGAMENTOS / TRANSFERÊNCIAS / SAQUES VIA API (com fluxo de aprovação)
-- ---------------------------------------------------------------------
CREATE TABLE pagamentos_bancarios (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID NOT NULL REFERENCES empresas(id),
    conta_origem_id UUID NOT NULL REFERENCES contas_bancarias(id),
    conta_destino_id UUID REFERENCES contas_bancarias(id),         -- transferência entre contas próprias
    tipo          tipo_pagamento_bancario NOT NULL,
    favorecido_nome TEXT,
    favorecido_documento VARCHAR(14),
    dados_bancarios_id UUID REFERENCES pessoa_dados_bancarios(id),
    chave_pix     TEXT,
    codigo_barras TEXT,
    valor         NUMERIC(14,2) NOT NULL CHECK (valor > 0),
    data_pagamento DATE NOT NULL,                                  -- permite agendar
    descricao     TEXT,
    titulo_pagar_id UUID REFERENCES titulos_pagar(id),
    repasse_id    UUID,                                            -- FK adicionada abaixo
    status        status_pagamento_bancario NOT NULL DEFAULT 'RASCUNHO',
    solicitado_por UUID REFERENCES usuarios(id),
    solicitado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    aprovado_por  UUID REFERENCES usuarios(id),
    aprovado_em   TIMESTAMPTZ,
    rejeitado_motivo TEXT,
    id_externo    TEXT,                                            -- id retornado pelo banco
    end_to_end_id TEXT,                                            -- E2E do Pix
    efetivado_em  TIMESTAMPTZ,
    movimento_id  UUID REFERENCES movimentos_bancarios(id),
    erro_mensagem TEXT,
    chave_idempotencia UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    -- Quem aprova deve ter papel MASTER na empresa (validado na aplicação: o CHECK não enxerga outra tabela).
    -- O MASTER pode aprovar o que ele mesmo solicitou; toda aprovação grava usuário, data e IP em 'auditoria'.
    CONSTRAINT ck_pb_aprovacao CHECK ((status IN ('APROVADO','ENVIADO','AGENDADO','EFETIVADO')) = FALSE OR aprovado_por IS NOT NULL)
);
CREATE INDEX idx_pb_status ON pagamentos_bancarios(empresa_id, status, data_pagamento);

-- ---------------------------------------------------------------------
-- REPASSE A CREDORES
-- ---------------------------------------------------------------------
CREATE TABLE repasses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID NOT NULL REFERENCES empresas(id),
    credor_id     UUID NOT NULL REFERENCES pessoas(id),
    conta_origem_id UUID NOT NULL REFERENCES contas_bancarias(id),
    periodo_inicio DATE NOT NULL,
    periodo_fim    DATE NOT NULL,
    total_recebido NUMERIC(14,2) NOT NULL DEFAULT 0,
    percentual_comissao NUMERIC(5,2) NOT NULL DEFAULT 0,  -- % sobre recebido, digitado pelo financeiro
    total_comissao NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_honorarios NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_tarifas  NUMERIC(14,2) NOT NULL DEFAULT 0,
    outros_descontos NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_repasse  NUMERIC(14,2) NOT NULL DEFAULT 0,     -- = recebido - comissão - honorários - tarifas - descontos
    status        status_repasse NOT NULL DEFAULT 'RASCUNHO',
    pagamento_id  UUID REFERENCES pagamentos_bancarios(id),
    data_repasse  DATE,
    observacao    TEXT,
    rascunho_baixa_ids UUID[],
    criado_por    UUID REFERENCES usuarios(id),
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE pagamentos_bancarios
    ADD CONSTRAINT fk_pb_repasse FOREIGN KEY (repasse_id) REFERENCES repasses(id);

-- Cada baixa de título de cobrança entra em no máximo um repasse
CREATE TABLE repasse_itens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repasse_id    UUID NOT NULL REFERENCES repasses(id) ON DELETE CASCADE,
    baixa_id      UUID NOT NULL UNIQUE REFERENCES baixas(id),
    titulo_receber_id UUID NOT NULL REFERENCES titulos_receber(id),
    valor_recebido NUMERIC(14,2) NOT NULL,
    comissao      NUMERIC(14,2) NOT NULL DEFAULT 0,
    honorarios    NUMERIC(14,2) NOT NULL DEFAULT 0,
    tarifa        NUMERIC(14,2) NOT NULL DEFAULT 0,
    valor_repasse NUMERIC(14,2) NOT NULL
);

-- ---------------------------------------------------------------------
-- COMPROVANTES E ANEXOS (polimórfico)
-- ---------------------------------------------------------------------
CREATE TABLE anexos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID NOT NULL REFERENCES empresas(id),
    entidade      TEXT NOT NULL,       -- 'baixa','pagamento_bancario','titulo_pagar','titulo_receber','repasse'
    entidade_id   UUID NOT NULL,
    tipo          TEXT NOT NULL DEFAULT 'COMPROVANTE',   -- COMPROVANTE, NOTA_FISCAL, CONTRATO, OUTRO
    nome_arquivo  TEXT NOT NULL,
    mime_type     TEXT NOT NULL,
    tamanho_bytes BIGINT NOT NULL,
    hash_sha256   TEXT NOT NULL,
    storage_chave TEXT NOT NULL,       -- chave no S3/Storage (bucket privado)
    enviado_por   UUID REFERENCES usuarios(id),
    enviado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_anexos_ent ON anexos(entidade, entidade_id);

-- ---------------------------------------------------------------------
-- CONCILIAÇÃO BANCÁRIA
-- ---------------------------------------------------------------------
CREATE TABLE conciliacoes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movimento_id  UUID NOT NULL REFERENCES movimentos_bancarios(id),
    baixa_id      UUID REFERENCES baixas(id),
    pagamento_id  UUID REFERENCES pagamentos_bancarios(id),
    tipo          TEXT NOT NULL,        -- AUTOMATICA, SUGERIDA_CONFIRMADA, MANUAL
    feita_por     UUID REFERENCES usuarios(id),
    feita_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- FECHAMENTO DE PERÍODO (bloqueia edição retroativa)
-- ---------------------------------------------------------------------
CREATE TABLE fechamentos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID NOT NULL REFERENCES empresas(id),
    competencia   DATE NOT NULL,        -- primeiro dia do mês fechado
    fechado_por   UUID REFERENCES usuarios(id),
    fechado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, competencia)
);

-- ---------------------------------------------------------------------
-- AUDITORIA (toda alteração financeira)
-- ---------------------------------------------------------------------
CREATE TABLE auditoria (
    id            BIGSERIAL PRIMARY KEY,
    empresa_id    UUID,
    usuario_id    UUID,
    entidade      TEXT NOT NULL,
    entidade_id   UUID,
    acao          TEXT NOT NULL,        -- CRIAR, EDITAR, BAIXAR, ESTORNAR, APROVAR, REJEITAR, EXCLUIR
    antes         JSONB,
    depois        JSONB,
    ip            INET,
    em            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_aud_ent ON auditoria(entidade, entidade_id);

-- =====================================================================
-- VIEWS ÚTEIS
-- =====================================================================

-- Saldo calculado do sistema por conta (para comparar com saldo_banco)
CREATE VIEW v_saldo_conta AS
SELECT c.id AS conta_bancaria_id,
       c.empresa_id,
       c.apelido,
       c.saldo_inicial
         + COALESCE(SUM(CASE WHEN m.sentido='CREDITO' THEN m.valor ELSE -m.valor END), 0) AS saldo_sistema,
       c.saldo_banco,
       c.saldo_banco_em
FROM contas_bancarias c
LEFT JOIN movimentos_bancarios m
       ON m.conta_bancaria_id = c.id AND m.data_movimento >= c.data_saldo_inicial
GROUP BY c.id;

-- Saldo a repassar por credor (baixas de cobrança ainda fora de repasse)
CREATE VIEW v_saldo_credor AS
SELECT t.empresa_id,
       t.credor_id,
       SUM(b.valor_liquido) AS recebido_pendente_repasse,
       COUNT(*)             AS qtd_baixas
FROM baixas b
JOIN titulos_receber t ON t.id = b.titulo_receber_id
LEFT JOIN repasse_itens ri ON ri.baixa_id = b.id
WHERE t.credor_id IS NOT NULL
  AND b.estornada = FALSE
  AND ri.id IS NULL
GROUP BY t.empresa_id, t.credor_id;

-- Posição da conta: quanto do saldo é dinheiro de credores e quanto é da empresa.
-- (Como o recebimento é todo na mesma conta Inter, saldo_proprio = saldo_sistema - a repassar.)
CREATE VIEW v_posicao_empresa AS
SELECT s.empresa_id,
       SUM(s.saldo_sistema)                              AS saldo_total_contas,
       COALESCE(MAX(r.a_repassar), 0)                    AS a_repassar_credores,
       SUM(s.saldo_sistema) - COALESCE(MAX(r.a_repassar), 0) AS saldo_proprio
FROM v_saldo_conta s
LEFT JOIN (SELECT empresa_id, SUM(recebido_pendente_repasse) AS a_repassar
           FROM v_saldo_credor GROUP BY empresa_id) r USING (empresa_id)
GROUP BY s.empresa_id;

-- Fluxo de caixa previsto (a receber x a pagar em aberto por dia)
CREATE VIEW v_fluxo_previsto AS
SELECT empresa_id, data_vencimento AS dia,
       SUM(valor_original - valor_recebido) AS entradas,
       0::numeric AS saidas
FROM titulos_receber WHERE status IN ('ABERTO','PARCIAL','VENCIDO')
GROUP BY empresa_id, data_vencimento
UNION ALL
SELECT empresa_id, data_vencimento,
       0, SUM(valor_original - valor_pago)
FROM titulos_pagar WHERE status IN ('ABERTO','PARCIAL','VENCIDO')
GROUP BY empresa_id, data_vencimento;

CREATE TYPE status_cob_retorno AS ENUM ('PENDENTE', 'ENVIADO', 'FALHOU');

CREATE TABLE IF NOT EXISTS cob_retorno_eventos (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id         UUID NOT NULL REFERENCES empresas(id),
    tipo_evento        TEXT NOT NULL,
    codigo_acordo      TEXT,
    ordem_no_acordo    INTEGER NOT NULL DEFAULT 0,
    baixa_id           UUID REFERENCES baixas(id),
    titulo_receber_id  UUID REFERENCES titulos_receber(id),
    idempotency_key    TEXT NOT NULL UNIQUE,
    payload            JSONB NOT NULL,
    status             status_cob_retorno NOT NULL DEFAULT 'PENDENTE',
    tentativas         SMALLINT NOT NULL DEFAULT 0,
    ultimo_erro        TEXT,
    http_status        SMALLINT,
    enviado_em         TIMESTAMPTZ,
    criada_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cob_retorno_pendentes
  ON cob_retorno_eventos (status, codigo_acordo, ordem_no_acordo, criada_em)
  WHERE status = 'PENDENTE';

CREATE INDEX IF NOT EXISTS idx_cob_retorno_falhou
  ON cob_retorno_eventos (status, criada_em DESC)
  WHERE status = 'FALHOU';

-- =====================================================================
-- DADOS INICIAIS: plano de contas básico (categorias globais)
-- =====================================================================
INSERT INTO categorias (codigo, nome, natureza) VALUES
 ('1',      'RECEITAS',                       'RECEITA'),
 ('1.01',   'Recebimento de Cliente (Cobrança)','RECEITA'),
 ('1.02',   'Serviços',                       'RECEITA'),
 ('1.03',   'Cobrança Jurídica',              'RECEITA'),
 ('1.04',   'Comissões e Honorários',         'RECEITA'),
 ('1.99',   'Outras Receitas',                'RECEITA'),
 ('2',      'DESPESAS',                       'DESPESA'),
 ('2.01',   'Despesas de Escritório',         'DESPESA'),
 ('2.02',   'Despesas de Sistema',            'DESPESA'),
 ('2.03',   'Despesas com Advogado',          'DESPESA'),
 ('2.04',   'Taxas e Impostos',               'DESPESA'),
 ('2.05',   'Salário de Colaborador',         'DESPESA'),
 ('2.06',   'Repasse a Credores',             'DESPESA'),
 ('2.07',   'Tarifas Bancárias',              'DESPESA'),
 ('2.99',   'Outras Despesas',                'DESPESA');
