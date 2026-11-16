import { Injectable, UnprocessableEntityException } from '@nestjs/common';
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
import { InterHttpService } from '../inter/inter-http.service';
import { mapearExtratoInter, mapearSaldoInter } from '../inter/inter-extrato.mapper';
import { provedorFase3BPendente } from './provedor-nao-implementado';

@Injectable()
export class InterProvider implements BancoProvider {
  readonly provedor = ProvedorBancario.INTER;

  constructor(private http: InterHttpService) {}

  private exigeRef(ctx: BancoContext): string {
    if (!ctx.credencialRef) {
      throw new UnprocessableEntityException('credencial_ref obrigatória para conta Inter');
    }
    return ctx.credencialRef;
  }

  async consultarSaldo(ctx: BancoContext, dataSaldo?: string): Promise<SaldoBancoResult> {
    const ref = this.exigeRef(ctx);
    const payload = await this.http.consultarSaldo(ref, dataSaldo);
    return {
      saldo: mapearSaldoInter(payload),
      dataReferencia: String(payload.dataSaldo ?? dataSaldo ?? '').slice(0, 10) || undefined,
    };
  }

  async consultarExtrato(ctx: BancoContext, de: string, ate: string): Promise<ExtratoBancoResult> {
    const ref = this.exigeRef(ctx);
    const payload = await this.http.consultarExtrato(ref, de, ate);
    const linhas = mapearExtratoInter(payload);
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