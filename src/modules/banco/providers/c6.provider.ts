import { Injectable } from '@nestjs/common';
import { ProvedorBancario } from '../../../database/enums';
import {
  BancoContext,
  BancoProvider,
  CobrancaConsultada,
  CobrancaEmitida,
  EmitirCobrancaInput,
  ExtratoBancoResult,
  PagamentoConsultado,
  PagarBoletoInput,
  PagarPixInput,
  PagamentoIniciado,
  SaldoBancoResult,
} from '../banco-provider.types';
import { provedorFase3BPendente } from './provedor-nao-implementado';

/** Esqueleto C6; início com OFX/manual conforme especificação. */
@Injectable()
export class C6Provider implements BancoProvider {
  readonly provedor = ProvedorBancario.C6;

  consultarSaldo(_ctx: BancoContext, _dataSaldo?: string): Promise<SaldoBancoResult> {
    return Promise.reject(provedorFase3BPendente('C6 consultarSaldo'));
  }

  consultarExtrato(_ctx: BancoContext, _de: string, _ate: string): Promise<ExtratoBancoResult> {
    return Promise.reject(provedorFase3BPendente('C6 consultarExtrato'));
  }

  emitirCobranca(_ctx: BancoContext, _input: EmitirCobrancaInput): Promise<CobrancaEmitida> {
    return Promise.reject(provedorFase3BPendente('C6 emitirCobranca'));
  }

  consultarCobranca(_ctx: BancoContext, _idExterno: string): Promise<CobrancaConsultada> {
    return Promise.reject(provedorFase3BPendente('C6 consultarCobranca'));
  }

  cancelarCobranca(_ctx: BancoContext, _idExterno: string): Promise<void> {
    return Promise.reject(provedorFase3BPendente('C6 cancelarCobranca'));
  }

  pagarPix(_ctx: BancoContext, _input: PagarPixInput): Promise<PagamentoIniciado> {
    return Promise.reject(provedorFase3BPendente('C6 pagarPix'));
  }

  pagarBoleto(_ctx: BancoContext, _input: PagarBoletoInput): Promise<PagamentoIniciado> {
    return Promise.reject(provedorFase3BPendente('C6 pagarBoleto'));
  }

  consultarPagamento(_ctx: BancoContext, _idExterno: string): Promise<PagamentoConsultado> {
    return Promise.reject(provedorFase3BPendente('C6 consultarPagamento'));
  }

  baixarComprovante(_ctx: BancoContext, _idExterno: string): Promise<Buffer> {
    return Promise.reject(provedorFase3BPendente('C6 baixarComprovante'));
  }
}