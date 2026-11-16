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