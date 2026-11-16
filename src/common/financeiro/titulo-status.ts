import { StatusTitulo } from '../../database/enums';
import { fromMoney, roundMoney, saldoTituloPagar, saldoTituloReceber } from '../utils/money';

export function aplicarBaixaReceber(
  titulo: {
    valorOriginal: string;
    desconto: string;
    juros: string;
    multa: string;
    valorRecebido: string;
    status: StatusTitulo;
    dataPagamento: string | null;
  },
  valorLiquido: number,
  dataBaixa: string,
) {
  const novoRecebido = roundMoney(fromMoney(titulo.valorRecebido) + valorLiquido);
  titulo.valorRecebido = novoRecebido.toFixed(2);
  const saldo = saldoTituloReceber({ ...titulo, valorRecebido: titulo.valorRecebido });
  if (saldo <= 0.009) {
    titulo.status = StatusTitulo.PAGO;
    titulo.dataPagamento = dataBaixa;
  } else {
    titulo.status = StatusTitulo.PARCIAL;
  }
}

export function aplicarEstornoReceber(
  titulo: {
    valorOriginal: string;
    desconto: string;
    juros: string;
    multa: string;
    valorRecebido: string;
    status: StatusTitulo;
    dataPagamento: string | null;
  },
  valorLiquido: number,
) {
  const novoRecebido = Math.max(0, roundMoney(fromMoney(titulo.valorRecebido) - valorLiquido));
  titulo.valorRecebido = novoRecebido.toFixed(2);
  titulo.status = novoRecebido <= 0.009 ? StatusTitulo.ABERTO : StatusTitulo.PARCIAL;
  titulo.dataPagamento = null;
}

export function aplicarBaixaPagar(
  titulo: {
    valorOriginal: string;
    desconto: string;
    juros: string;
    multa: string;
    valorPago: string;
    status: StatusTitulo;
    dataPagamento: string | null;
  },
  valorLiquido: number,
  dataBaixa: string,
) {
  const novoPago = roundMoney(fromMoney(titulo.valorPago) + valorLiquido);
  titulo.valorPago = novoPago.toFixed(2);
  const saldo = saldoTituloPagar({ ...titulo, valorPago: titulo.valorPago });
  if (saldo <= 0.009) {
    titulo.status = StatusTitulo.PAGO;
    titulo.dataPagamento = dataBaixa;
  } else {
    titulo.status = StatusTitulo.PARCIAL;
  }
}

export function aplicarEstornoPagar(
  titulo: {
    valorOriginal: string;
    desconto: string;
    juros: string;
    multa: string;
    valorPago: string;
    status: StatusTitulo;
    dataPagamento: string | null;
  },
  valorLiquido: number,
) {
  const novoPago = Math.max(0, roundMoney(fromMoney(titulo.valorPago) - valorLiquido));
  titulo.valorPago = novoPago.toFixed(2);
  titulo.status = novoPago <= 0.009 ? StatusTitulo.ABERTO : StatusTitulo.PARCIAL;
  titulo.dataPagamento = null;
}