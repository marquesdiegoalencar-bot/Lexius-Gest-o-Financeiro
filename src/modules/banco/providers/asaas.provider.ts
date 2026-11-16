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

/** Esqueleto Asaas (legado); implementação na migração paralela. */
@Injectable()
export class AsaasProvider implements BancoProvider {
  readonly provedor = ProvedorBancario.ASAAS;

  consultarSaldo(_ctx: BancoContext, _dataSaldo?: string): Promise<SaldoBancoResult> {
    return Promise.reject(provedorFase3BPendente('Asaas consultarSaldo'));
  }

  consultarExtrato(_ctx: BancoContext, _de: string, _ate: string): Promise<ExtratoBancoResult> {
    return Promise.reject(provedorFase3BPendente('Asaas consultarExtrato'));
  }

  emitirCobranca(_ctx: BancoContext, _input: EmitirCobrancaInput): Promise<CobrancaEmitida> {
    return Promise.reject(provedorFase3BPendente('Asaas emitirCobranca'));
  }

  consultarCobranca(_ctx: BancoContext, _idExterno: string): Promise<CobrancaConsultada> {
    return Promise.reject(provedorFase3BPendente('Asaas consultarCobranca'));
  }

  cancelarCobranca(_ctx: BancoContext, _idExterno: string): Promise<void> {
    return Promise.reject(provedorFase3BPendente('Asaas cancelarCobranca'));
  }

  pagarPix(_ctx: BancoContext, _input: PagarPixInput): Promise<PagamentoIniciado> {
    return Promise.reject(provedorFase3BPendente('Asaas pagarPix'));
  }

  pagarBoleto(_ctx: BancoContext, _input: PagarBoletoInput): Promise<PagamentoIniciado> {
    return Promise.reject(provedorFase3BPendente('Asaas pagarBoleto'));
  }

  consultarPagamento(_ctx: BancoContext, _idExterno: string): Promise<PagamentoConsultado> {
    return Promise.reject(provedorFase3BPendente('Asaas consultarPagamento'));
  }

  baixarComprovante(_ctx: BancoContext, _idExterno: string): Promise<Buffer> {
    return Promise.reject(provedorFase3BPendente('Asaas baixarComprovante'));
  }
}