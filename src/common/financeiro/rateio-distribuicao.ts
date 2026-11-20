import { roundMoney, toMoneyString } from '../utils/money';
import { ModoRateio } from '../../database/enums';

export type LinhaRateioDistribuicao = {
  linha: number;
  centro_custo_id?: string | null;
  departamento_id?: string | null;
  percentual?: number | null;
  valor?: number | null;
};

export function distribuirValorPorRateio(
  total: number,
  modo: ModoRateio,
  linhas: LinhaRateioDistribuicao[],
): { linha: number; valor: string; percentual_ref: string | null }[] {
  if (linhas.length === 0) return [];
  const ordenadas = [...linhas].sort((a, b) => a.linha - b.linha);
  const out: { linha: number; valor: string; percentual_ref: string | null }[] = [];
  let acumulado = 0;

  if (modo === ModoRateio.PERCENTUAL) {
    for (let i = 0; i < ordenadas.length; i++) {
      const linha = ordenadas[i]!;
      const pct = linha.percentual ?? 0;
      let parte: number;
      if (i === ordenadas.length - 1) {
        parte = roundMoney(total - acumulado);
      } else {
        parte = roundMoney((total * pct) / 100);
        acumulado = roundMoney(acumulado + parte);
      }
      out.push({
        linha: linha.linha,
        valor: toMoneyString(parte),
        percentual_ref: pct.toFixed(4),
      });
    }
    return out;
  }

  const somaFixos = ordenadas.reduce((s, l) => s + (l.valor ?? 0), 0);
  if (Math.abs(somaFixos - total) > 0.02 && somaFixos > 0) {
    const fator = total / somaFixos;
    for (let i = 0; i < ordenadas.length; i++) {
      const linha = ordenadas[i]!;
      let parte: number;
      if (i === ordenadas.length - 1) {
        parte = roundMoney(total - acumulado);
      } else {
        parte = roundMoney((linha.valor ?? 0) * fator);
        acumulado = roundMoney(acumulado + parte);
      }
      out.push({
        linha: linha.linha,
        valor: toMoneyString(parte),
        percentual_ref: total > 0 ? ((parte / total) * 100).toFixed(4) : null,
      });
    }
    return out;
  }

  for (let i = 0; i < ordenadas.length; i++) {
    const linha = ordenadas[i]!;
    let parte: number;
    if (i === ordenadas.length - 1) {
      parte = roundMoney(total - acumulado);
    } else {
      parte = roundMoney(linha.valor ?? 0);
      acumulado = roundMoney(acumulado + parte);
    }
    out.push({
      linha: linha.linha,
      valor: toMoneyString(parte),
      percentual_ref: total > 0 ? ((fromParte(parte, total) * 100) || 0).toFixed(4) : null,
    });
  }
  return out;
}

function fromParte(parte: number, total: number): number {
  return total > 0 ? roundMoney(parte / total) : 0;
}

export function validarTotaisRateio(
  modo: ModoRateio,
  linhas: LinhaRateioDistribuicao[],
  valorTitulo: number,
): void {
  if (!linhas.length) {
    throw new Error('RATEIO_VAZIO');
  }
  if (modo === ModoRateio.PERCENTUAL) {
    const soma = roundMoney(linhas.reduce((s, l) => s + (l.percentual ?? 0), 0));
    if (Math.abs(soma - 100) > 0.0001) {
      throw new Error('PERCENTUAL_INVALIDO');
    }
    return;
  }
  const soma = roundMoney(linhas.reduce((s, l) => s + (l.valor ?? 0), 0));
  if (Math.abs(soma - valorTitulo) > 0.01) {
    throw new Error('VALOR_FIXO_INVALIDO');
  }
}