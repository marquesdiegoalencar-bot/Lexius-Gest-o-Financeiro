import { ProvedorBancario } from '../../database/enums';

export type BancoContext = {
  contaBancariaId: string;
  empresaId: string;
  credencialRef: string | null;
};

export type SaldoBancoResult = {
  saldo: number;
  dataReferencia?: string;
  moeda?: string;
};

export type LinhaExtratoBanco = {
  idExterno: string;
  dataMovimento: string;
  valor: number;
  sentido: 'CREDITO' | 'DEBITO';
  descricao?: string;
  tipoTransacao?: string;
  contraparteNome?: string;
  contraparteDocumento?: string;
};

export type ExtratoBancoResult = {
  linhas: LinhaExtratoBanco[];
  de: string;
  ate: string;
};

export type EmitirCobrancaInput = {
  valor: number;
  dataVencimento: string;
  nomePagador: string;
  documentoPagador: string;
  seuNumero: string;
  descricao?: string;
};

export type CobrancaEmitida = {
  idExterno: string;
  linhaDigitavel?: string;
  codigoBarras?: string;
  pixCopiaECola?: string;
  pdfUrl?: string;
};

export type CobrancaConsultada = {
  idExterno: string;
  status: string;
  valor?: number;
  pagoEm?: string;
};

export type PagarPixInput = {
  valor: number;
  chavePix: string;
  descricao?: string;
  idempotencia: string;
};

export type PagarBoletoInput = {
  codigoBarras: string;
  valor: number;
  dataPagamento: string;
  idempotencia: string;
};

export type PagamentoIniciado = {
  idExterno: string;
  status: string;
};

export type PagamentoConsultado = {
  idExterno: string;
  status: string;
  efetivadoEm?: string;
};

export interface BancoProvider {
  readonly provedor: ProvedorBancario;

  consultarSaldo(ctx: BancoContext, dataSaldo?: string): Promise<SaldoBancoResult>;
  consultarExtrato(ctx: BancoContext, de: string, ate: string): Promise<ExtratoBancoResult>;
  emitirCobranca(ctx: BancoContext, input: EmitirCobrancaInput): Promise<CobrancaEmitida>;
  consultarCobranca(ctx: BancoContext, idExterno: string): Promise<CobrancaConsultada>;
  cancelarCobranca(ctx: BancoContext, idExterno: string): Promise<void>;
  pagarPix(ctx: BancoContext, input: PagarPixInput): Promise<PagamentoIniciado>;
  pagarBoleto(ctx: BancoContext, input: PagarBoletoInput): Promise<PagamentoIniciado>;
  consultarPagamento(ctx: BancoContext, idExterno: string): Promise<PagamentoConsultado>;
  baixarComprovante(ctx: BancoContext, idExterno: string): Promise<Buffer>;
}