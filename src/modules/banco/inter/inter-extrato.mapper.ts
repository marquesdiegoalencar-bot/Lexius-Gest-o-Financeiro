import { createHash } from 'crypto';
import { LinhaExtratoBanco } from '../banco-provider.types';

type TransacaoInter = {
  idTransacao?: string;
  numeroDocumento?: string;
  dataEntrada?: string;
  dataTransacao?: string;
  valor?: string | number;
  tipoOperacao?: string;
  tipoTransacao?: string;
  descricao?: string;
  titulo?: string;
  nome?: string;
  cpfCnpj?: string;
};

export function mapearExtratoInter(payload: Record<string, unknown>): LinhaExtratoBanco[] {
  const lista = payload.transacoes ?? payload.transações ?? payload.lancamentos;
  if (!Array.isArray(lista)) {
    return [];
  }

  return (lista as TransacaoInter[])
    .map((tx) => {
      const valorNum = Math.abs(Number(tx.valor ?? 0));
      if (!valorNum) return null;

      const data = tx.dataEntrada ?? tx.dataTransacao;
      if (!data) return null;

      const tipoOp = String(tx.tipoOperacao ?? '').toUpperCase();
      const sentido = tipoOp === 'D' ? 'DEBITO' : 'CREDITO';

      const idRaw =
        tx.idTransacao ??
        tx.numeroDocumento ??
        `${data}|${valorNum}|${tx.descricao ?? tx.titulo ?? ''}`;
      const idExterno = String(idRaw).startsWith('inter-')
        ? String(idRaw)
        : `inter-${idRaw}`;
      const idFinal =
        idExterno.length > 200
          ? `inter-${createHash('sha256').update(idExterno).digest('hex')}`
          : idExterno;

      return {
        idExterno: idFinal,
        dataMovimento: String(data).slice(0, 10),
        valor: valorNum,
        sentido,
        descricao: tx.descricao ?? tx.titulo ?? undefined,
        tipoTransacao: tx.tipoTransacao ?? undefined,
        contraparteNome: tx.nome ?? undefined,
        contraparteDocumento: tx.cpfCnpj?.replace(/\D/g, '').slice(0, 14),
      } as LinhaExtratoBanco;
    })
    .filter((l): l is LinhaExtratoBanco => l !== null);
}

export function mapearSaldoInter(payload: Record<string, unknown>): number {
  const campo = payload.disponivel ?? payload.saldo ?? payload.bloqueadoCheque ?? payload.total;
  return Number(campo ?? 0);
}