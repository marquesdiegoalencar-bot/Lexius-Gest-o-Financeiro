export enum TipoEmpresa {
  COBRANCA = 'COBRANCA',
  SISTEMAS = 'SISTEMAS',
  ADVOCACIA = 'ADVOCACIA',
  OUTRA = 'OUTRA',
}

export enum PapelUsuario {
  MASTER = 'MASTER',
  ADMIN = 'ADMIN',
  FINANCEIRO = 'FINANCEIRO',
  OPERADOR = 'OPERADOR',
  CONSULTA = 'CONSULTA',
}

export enum TipoPessoa {
  FISICA = 'FISICA',
  JURIDICA = 'JURIDICA',
}

export enum Natureza {
  RECEITA = 'RECEITA',
  DESPESA = 'DESPESA',
}

export enum TipoCentroCusto {
  ENTRADA = 'ENTRADA',
  SAIDA = 'SAIDA',
}

export enum ProvedorBancario {
  INTER = 'INTER',
  ASAAS = 'ASAAS',
  C6 = 'C6',
  MANUAL = 'MANUAL',
  OUTRO = 'OUTRO',
}

export enum TipoContaBancaria {
  CORRENTE = 'CORRENTE',
  POUPANCA = 'POUPANCA',
  PAGAMENTO = 'PAGAMENTO',
  CAIXA = 'CAIXA',
  CARTAO = 'CARTAO',
}

export enum FormaPagamento {
  BOLETO = 'BOLETO',
  PIX = 'PIX',
  TED = 'TED',
  DOC = 'DOC',
  DINHEIRO = 'DINHEIRO',
  CARTAO = 'CARTAO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  DEBITO_AUTOMATICO = 'DEBITO_AUTOMATICO',
  OUTRO = 'OUTRO',
}

export enum OrigemTitulo {
  MANUAL = 'MANUAL',
  COBRANCA_BOLETO = 'COBRANCA_BOLETO',
  COBRANCA_ACORDO = 'COBRANCA_ACORDO',
  RECORRENCIA = 'RECORRENCIA',
  IMPORTACAO = 'IMPORTACAO',
  REPASSE = 'REPASSE',
  INTERGRUPO = 'INTERGRUPO',
}

export enum StatusRepasse {
  RASCUNHO = 'RASCUNHO',
  CALCULADO = 'CALCULADO',
  AGUARDANDO_APROVACAO = 'AGUARDANDO_APROVACAO',
  APROVADO = 'APROVADO',
  PAGO = 'PAGO',
  CANCELADO = 'CANCELADO',
}

export enum TipoPagamentoBancario {
  PIX = 'PIX',
  BOLETO = 'BOLETO',
  TED = 'TED',
  TRANSFERENCIA_INTERNA = 'TRANSFERENCIA_INTERNA',
  DARF = 'DARF',
  SAQUE = 'SAQUE',
}

export enum StatusPagamentoBancario {
  RASCUNHO = 'RASCUNHO',
  AGUARDANDO_APROVACAO = 'AGUARDANDO_APROVACAO',
  APROVADO = 'APROVADO',
  REJEITADO = 'REJEITADO',
  ENVIADO = 'ENVIADO',
  AGENDADO = 'AGENDADO',
  EFETIVADO = 'EFETIVADO',
  FALHOU = 'FALHOU',
  CANCELADO = 'CANCELADO',
}

export enum StatusCobRetorno {
  PENDENTE = 'PENDENTE',
  ENVIADO = 'ENVIADO',
  FALHOU = 'FALHOU',
}

export enum StatusTitulo {
  ABERTO = 'ABERTO',
  PARCIAL = 'PARCIAL',
  PAGO = 'PAGO',
  VENCIDO = 'VENCIDO',
  CANCELADO = 'CANCELADO',
  RENEGOCIADO = 'RENEGOCIADO',
}

export enum SentidoMovimento {
  CREDITO = 'CREDITO',
  DEBITO = 'DEBITO',
}

export enum OrigemMovimento {
  API_BANCO = 'API_BANCO',
  OFX = 'OFX',
  MANUAL = 'MANUAL',
  BAIXA = 'BAIXA',
  TRANSFERENCIA = 'TRANSFERENCIA',
  REPASSE = 'REPASSE',
  AJUSTE = 'AJUSTE',
}

export enum StatusAprovacaoTituloPagar {
  PENDENTE = 'PENDENTE',
  APROVADO = 'APROVADO',
  REJEITADO = 'REJEITADO',
}

export enum StatusCobranca {
  EMITIDA = 'EMITIDA',
  REGISTRADA = 'REGISTRADA',
  PAGA = 'PAGA',
  VENCIDA = 'VENCIDA',
  CANCELADA = 'CANCELADA',
  EXPIRADA = 'EXPIRADA',
  ERRO = 'ERRO',
}

/** Discrimina cobrança registrada em cobrancas_boleto (Inter). */
export enum ModalidadeCobranca {
  COBRANCA_V3 = 'COBRANCA_V3',
  PIX_COBV = 'PIX_COBV',
}