import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProvedorBancario } from '../../../database/enums';
import {
  BancoContext,
  BancoProvider,
  CobrancaConsultada,
  CobrancaEmitida,
  EmitirCobrancaInput,
  ExtratoBancoResult,
  LinhaExtratoBanco,
  PagamentoConsultado,
  PagarBoletoInput,
  PagarPixInput,
  PagamentoIniciado,
  SaldoBancoResult,
} from '../banco-provider.types';
import { provedorFase3BPendente } from './provedor-nao-implementado';

@Injectable()
export class ManualProvider implements BancoProvider {
  readonly provedor = ProvedorBancario.MANUAL;

  constructor(private dataSource: DataSource) {}

  async consultarSaldo(ctx: BancoContext): Promise<SaldoBancoResult> {
    const [row] = await this.dataSource.query(
      `SELECT COALESCE(saldo_sistema, 0)::float AS saldo
       FROM v_saldo_conta WHERE conta_bancaria_id = $1`,
      [ctx.contaBancariaId],
    );
    const [conta] = await this.dataSource.query(
      `SELECT saldo_banco::float, saldo_banco_em FROM contas_bancarias WHERE id = $1`,
      [ctx.contaBancariaId],
    );
    const sistema = Number(row?.saldo ?? 0);
    const banco = conta?.saldo_banco != null ? Number(conta.saldo_banco) : sistema;
    return {
      saldo: banco,
      dataReferencia: conta?.saldo_banco_em
        ? new Date(conta.saldo_banco_em).toISOString().slice(0, 10)
        : undefined,
    };
  }

  async consultarExtrato(ctx: BancoContext, de: string, ate: string): Promise<ExtratoBancoResult> {
    const rows = await this.dataSource.query(
      `SELECT id_externo, data_movimento, valor::float, sentido, descricao, tipo_transacao,
              contraparte_nome, contraparte_documento
       FROM movimentos_bancarios
       WHERE conta_bancaria_id = $1 AND data_movimento BETWEEN $2 AND $3
       ORDER BY data_movimento, criado_em`,
      [ctx.contaBancariaId, de, ate],
    );
    const linhas: LinhaExtratoBanco[] = rows.map(
      (r: {
        id_externo: string;
        data_movimento: string;
        valor: number;
        sentido: string;
        descricao: string;
        tipo_transacao: string;
        contraparte_nome: string;
        contraparte_documento: string;
      }) => ({
        idExterno: r.id_externo ?? `manual-${r.data_movimento}-${r.valor}`,
        dataMovimento: r.data_movimento,
        valor: r.valor,
        sentido: r.sentido as 'CREDITO' | 'DEBITO',
        descricao: r.descricao ?? undefined,
        tipoTransacao: r.tipo_transacao ?? undefined,
        contraparteNome: r.contraparte_nome ?? undefined,
        contraparteDocumento: r.contraparte_documento ?? undefined,
      }),
    );
    return { linhas, de, ate };
  }

  emitirCobranca(_ctx: BancoContext, _input: EmitirCobrancaInput): Promise<CobrancaEmitida> {
    return Promise.reject(provedorFase3BPendente('emitirCobranca'));
  }

  consultarCobranca(_ctx: BancoContext, _idExterno: string): Promise<CobrancaConsultada> {
    return Promise.reject(provedorFase3BPendente('consultarCobranca'));
  }

  cancelarCobranca(_ctx: BancoContext, _idExterno: string): Promise<void> {
    return Promise.reject(provedorFase3BPendente('cancelarCobranca'));
  }

  pagarPix(_ctx: BancoContext, _input: PagarPixInput): Promise<PagamentoIniciado> {
    return Promise.reject(provedorFase3BPendente('pagarPix'));
  }

  pagarBoleto(_ctx: BancoContext, _input: PagarBoletoInput): Promise<PagamentoIniciado> {
    return Promise.reject(provedorFase3BPendente('pagarBoleto'));
  }

  consultarPagamento(_ctx: BancoContext, _idExterno: string): Promise<PagamentoConsultado> {
    return Promise.reject(provedorFase3BPendente('consultarPagamento'));
  }

  baixarComprovante(_ctx: BancoContext, _idExterno: string): Promise<Buffer> {
    return Promise.reject(provedorFase3BPendente('baixarComprovante'));
  }
}