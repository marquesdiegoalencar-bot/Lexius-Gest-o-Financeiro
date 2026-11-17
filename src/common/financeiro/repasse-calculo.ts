import { fromMoney, roundMoney, toMoneyString } from '../utils/money';

export type BaixaRepasseValores = {
  valorLiquido: string;
  tarifa: string;
};

/** Bruto recebido na conta (antes do desconto da tarifa no líquido). */
export function valorBrutoRecebidoBaixa(baixa: BaixaRepasseValores): number {
  return roundMoney(fromMoney(baixa.valorLiquido) + fromMoney(baixa.tarifa));
}

export type ItemRepasseCalculado = {
  valorRecebidoBruto: number;
  comissao: number;
  honorarios: number;
  tarifa: number;
  valorRepasse: number;
};

/**
 * Comissão sobre o bruto; repasse = bruto − comissão − honorários − tarifa.
 * Referência: bruto 100, tarifa 0,90, comissão 10% → repasse 89,10.
 */
export function calcularItemRepasse(params: {
  baixa: BaixaRepasseValores;
  percentualComissao: number;
  honorarios?: number;
}): ItemRepasseCalculado {
  const bruto = valorBrutoRecebidoBaixa(params.baixa);
  const tarifa = fromMoney(params.baixa.tarifa);
  const honorarios = roundMoney(params.honorarios ?? 0);
  const comissao = roundMoney((bruto * params.percentualComissao) / 100);
  const valorRepasse = roundMoney(bruto - comissao - honorarios - tarifa);
  return {
    valorRecebidoBruto: bruto,
    comissao,
    honorarios,
    tarifa,
    valorRepasse,
  };
}

export function distribuirComissaoItens(
  brutos: number[],
  percentualComissao: number,
): number[] {
  if (!brutos.length) return [];
  const totalBruto = roundMoney(brutos.reduce((s, v) => s + v, 0));
  const comissaoTotal = roundMoney((totalBruto * percentualComissao) / 100);
  const comissoes = brutos.map((b) =>
    totalBruto > 0 ? roundMoney((comissaoTotal * b) / totalBruto) : 0,
  );
  const soma = roundMoney(comissoes.reduce((s, v) => s + v, 0));
  const delta = roundMoney(comissaoTotal - soma);
  if (delta !== 0) {
    comissoes[comissoes.length - 1] = roundMoney(comissoes[comissoes.length - 1] + delta);
  }
  return comissoes;
}

export function toMoneyFields(item: ItemRepasseCalculado) {
  return {
    valor_recebido: toMoneyString(item.valorRecebidoBruto),
    comissao: toMoneyString(item.comissao),
    honorarios: toMoneyString(item.honorarios),
    tarifa: toMoneyString(item.tarifa),
    valor_repasse: toMoneyString(item.valorRepasse),
  };
}