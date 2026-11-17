import { roundMoney } from '../../../common/utils/money';

export type CobvConsultaNormalizada = {
  txid: string;
  status: string;
  valorNominal: number;
  dataDeVencimento: string;
  validadeAposVencimento: number;
  dataLimitePagamento: string | null;
  pixCopiaECola: string | null;
  pixRecebidos: CobvPixRecebido[];
};

export type CobvPixRecebido = {
  endToEndId: string;
  valor: number;
  horario: string;
  valorPrincipal: number;
  juros: number;
  multa: number;
  desconto: number;
};

const STATUS_PAGO = new Set(['CONCLUIDA']);
const STATUS_REMOVIDA = new Set(['REMOVIDA_PELO_USUARIO', 'REMOVIDA_PELO_PSP']);

function num(v: unknown): number {
  if (v == null || v === '') return 0;
  return roundMoney(Number(v));
}

function parseDataLimite(dataDeVencimento: string, validadeAposVencimento: number): string | null {
  if (!dataDeVencimento) return null;
  const base = new Date(`${dataDeVencimento}T23:59:59`);
  if (Number.isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + Math.max(0, validadeAposVencimento));
  return base.toISOString().slice(0, 10);
}

function parsePixRecebido(row: Record<string, unknown>): CobvPixRecebido {
  const comp = (row.componentesValor ?? {}) as Record<string, { valor?: string; valorAbatimento?: string }>;
  const original = num(comp.original?.valor);
  const juros = num(comp.juros?.valor ?? comp.juros?.valorAbatimento);
  const multa = num(comp.multa?.valor);
  const desconto = num(comp.desconto?.valor ?? comp.desconto?.valorAbatimento ?? comp.abatimento?.valor);
  const valorPago = num(row.valor);
  const valorPrincipal =
    original > 0 ? original : roundMoney(valorPago - juros - multa + desconto);
  return {
    endToEndId: String(row.endToEndId ?? ''),
    valor: valorPago,
    horario: String(row.horario ?? '').slice(0, 10),
    valorPrincipal,
    juros,
    multa,
    desconto,
  };
}

export function normalizarConsultaCobvInter(txid: string, payload: Record<string, unknown>): CobvConsultaNormalizada {
  const root = (payload.cobv ?? payload) as Record<string, unknown>;
  const cal = (root.calendario ?? {}) as Record<string, unknown>;
  const valorObj = (root.valor ?? {}) as Record<string, unknown>;
  const dataDeVencimento = String(cal.dataDeVencimento ?? '').slice(0, 10);
  const validadeAposVencimento = Number(cal.validadeAposVencimento ?? 0);
  const pixRaw = (root.pix ?? []) as Array<Record<string, unknown>>;
  const pixRecebidos = pixRaw.map(parsePixRecebido).filter((p) => p.valor > 0);

  const loc = root.loc as Record<string, unknown> | undefined;
  const pixCopiaECola =
    (root.pixCopiaECola as string | undefined) ??
    (loc?.location as string | undefined) ??
    null;

  return {
    txid: String(root.txid ?? txid),
    status: String(root.status ?? '').toUpperCase(),
    valorNominal: num(valorObj.original ?? valorObj.valor),
    dataDeVencimento,
    validadeAposVencimento,
    dataLimitePagamento: parseDataLimite(dataDeVencimento, validadeAposVencimento),
    pixCopiaECola,
    pixRecebidos,
  };
}

export function cobvConsideradaPaga(c: CobvConsultaNormalizada): boolean {
  return STATUS_PAGO.has(c.status) && c.pixRecebidos.length > 0;
}

export function cobvExpirada(c: CobvConsultaNormalizada, hoje = new Date()): boolean {
  if (cobvConsideradaPaga(c)) return false;
  if (STATUS_REMOVIDA.has(c.status)) return true;
  if (c.dataLimitePagamento) {
    const limite = new Date(`${c.dataLimitePagamento}T23:59:59`);
    return hoje > limite;
  }
  return false;
}

/** Agrega pagamentos usando somente o array `pix` do GET. */
export function componentesBaixaDeCobv(c: CobvConsultaNormalizada): {
  valorPrincipal: number;
  juros: number;
  multa: number;
  desconto: number;
  valorRecebidoBruto: number;
  endToEndIds: string[];
  dataPagamento: string | null;
} {
  let valorPrincipal = 0;
  let juros = 0;
  let multa = 0;
  let desconto = 0;
  let bruto = 0;
  const endToEndIds: string[] = [];
  let dataPagamento: string | null = null;

  for (const p of c.pixRecebidos) {
    bruto = roundMoney(bruto + p.valor);
    valorPrincipal = roundMoney(valorPrincipal + p.valorPrincipal);
    juros = roundMoney(juros + p.juros);
    multa = roundMoney(multa + p.multa);
    desconto = roundMoney(desconto + p.desconto);
    if (p.endToEndId) endToEndIds.push(p.endToEndId);
    if (p.horario) dataPagamento = p.horario;
  }

  return { valorPrincipal, juros, multa, desconto, valorRecebidoBruto: bruto, endToEndIds, dataPagamento };
}

export function montarBodyPutCobv(params: {
  txid: string;
  chavePix: string;
  valor: number;
  dataVencimento: string;
  devedorNome: string;
  devedorCpfCnpj: string;
  solicitacaoPagador?: string;
}): Record<string, unknown> {
  const doc = params.devedorCpfCnpj.replace(/\D/g, '');
  const devedor =
    doc.length > 11
      ? { cnpj: doc, nome: params.devedorNome }
      : { cpf: doc, nome: params.devedorNome };
  return {
    calendario: {
      dataDeVencimento: params.dataVencimento,
      validadeAposVencimento: 30,
    },
    devedor,
    valor: { original: params.valor.toFixed(2) },
    chave: params.chavePix,
    solicitacaoPagador: params.solicitacaoPagador ?? `Cobrança ${params.txid}`,
  };
}