import { roundMoney } from '../../../common/utils/money';

export type CobrancaConsultaNormalizada = {
  codigoSolicitacao: string;
  situacao: string;
  valorNominal: number;
  valorTotalRecebido: number | null;
  juros: number;
  multa: number;
  desconto: number;
  dataPagamento: string | null;
  linhaDigitavel?: string;
  codigoBarras?: string;
  pixCopiaECola?: string;
  formaRecebimento?: string;
};

const SITUACOES_PAGAS = new Set(['RECEBIDO', 'PAGO', 'MARCADO_RECEBIDO']);

export function normalizarConsultaCobrancaInter(
  codigo: string,
  payload: Record<string, unknown>,
): CobrancaConsultaNormalizada {
  const cobranca = (payload.cobranca ?? payload) as Record<string, unknown>;
  const situacao = String(cobranca.situacao ?? cobranca.status ?? '').toUpperCase();
  return {
    codigoSolicitacao: codigo,
    situacao,
    valorNominal: Number(cobranca.valorNominal ?? cobranca.valor ?? 0),
    valorTotalRecebido:
      cobranca.valorTotalRecebido != null
        ? Number(cobranca.valorTotalRecebido)
        : cobranca.valorRecebido != null
          ? Number(cobranca.valorRecebido)
          : null,
    juros: Number(cobranca.juros ?? cobranca.mora ?? 0),
    multa: Number(cobranca.multa ?? 0),
    desconto: Number(cobranca.desconto ?? 0),
    dataPagamento: String(
      cobranca.dataHoraSituacao ?? cobranca.dataPagamento ?? '',
    ).slice(0, 10) || null,
    linhaDigitavel: cobranca.linhaDigitavel as string | undefined,
    codigoBarras: cobranca.codigoBarras as string | undefined,
    pixCopiaECola: (cobranca.pixCopiaECola ?? cobranca.pixCopiaCola) as string | undefined,
    formaRecebimento: cobranca.formaRecebimento as string | undefined,
  };
}

export function cobrancaInterConsideradaPaga(c: CobrancaConsultaNormalizada): boolean {
  return SITUACOES_PAGAS.has(c.situacao) && (c.valorTotalRecebido ?? 0) > 0;
}

export function componentesBaixaDeCobranca(c: CobrancaConsultaNormalizada): {
  valorPrincipal: number;
  juros: number;
  multa: number;
  desconto: number;
  valorRecebidoBruto: number;
} {
  const valorRecebidoBruto = c.valorTotalRecebido ?? 0;
  const juros = roundMoney(c.juros);
  const multa = roundMoney(c.multa);
  const desconto = roundMoney(c.desconto);
  const valorPrincipal = roundMoney(valorRecebidoBruto - juros - multa + desconto);
  return { valorPrincipal, juros, multa, desconto, valorRecebidoBruto };
}