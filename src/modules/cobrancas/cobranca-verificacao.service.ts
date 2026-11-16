import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { roundMoney } from '../../common/utils/money';
import { CobrancaBoleto } from '../../database/entities/cobranca-boleto.entity';
import { ContaBancaria } from '../../database/entities/conta-bancaria.entity';
import { WebhookEvento } from '../../database/entities/webhook-evento.entity';
import { FormaPagamento, ModalidadeCobranca, StatusCobranca } from '../../database/enums';
import { InterCobrancaHttpService } from '../banco/inter/inter-cobranca-http.service';
import {
  cobrancaInterConsideradaPaga,
  componentesBaixaDeCobranca,
  normalizarConsultaCobrancaInter,
} from '../banco/inter/inter-cobranca.mapper';
import { InterPixCobvHttpService } from '../banco/inter/inter-pix-cobv-http.service';
import {
  cobvConsideradaPaga,
  cobvExpirada,
  componentesBaixaDeCobv,
  normalizarConsultaCobvInter,
} from '../banco/inter/inter-pix-cobv.mapper';
import { BaixasService } from '../baixas/baixas.service';
import { BaixarTituloDto } from '../baixas/dto/baixar-titulo.dto';
import { TarifasCobrancaService } from '../tarifas-cobranca/tarifas-cobranca.service';

@Injectable()
export class CobrancaVerificacaoService {
  private readonly logger = new Logger(CobrancaVerificacaoService.name);

  constructor(
    private interCobranca: InterCobrancaHttpService,
    private interPixCobv: InterPixCobvHttpService,
    private baixas: BaixasService,
    private tarifas: TarifasCobrancaService,
    @InjectRepository(CobrancaBoleto) private cobrancas: Repository<CobrancaBoleto>,
    @InjectRepository(ContaBancaria) private contas: Repository<ContaBancaria>,
    @InjectRepository(WebhookEvento) private eventos: Repository<WebhookEvento>,
  ) {}

  async verificarCobrancaPorCodigo(codigoSolicitacao: string, eventoId?: string) {
    const cobranca = await this.cobrancas.findOne({
      where: { idExterno: codigoSolicitacao, modalidade: ModalidadeCobranca.COBRANCA_V3 },
    });
    if (!cobranca) {
      return { processado: false, motivo: 'COBRANCA_NAO_ENCONTRADA' };
    }
    return this.verificarRegistro(cobranca, eventoId);
  }

  async verificarCobvPorTxid(txid: string, eventoId?: string) {
    const cobranca = await this.cobrancas.findOne({
      where: [
        { idExterno: txid, modalidade: ModalidadeCobranca.PIX_COBV },
        { txid, modalidade: ModalidadeCobranca.PIX_COBV },
      ],
    });
    if (!cobranca) {
      return { processado: false, motivo: 'COBV_NAO_ENCONTRADA' };
    }
    return this.verificarRegistro(cobranca, eventoId);
  }

  private async verificarRegistro(cobranca: CobrancaBoleto, eventoId?: string) {
    if (cobranca.status === StatusCobranca.PAGA) {
      return { processado: true, motivo: 'JA_PAGA', cobrancaId: cobranca.id };
    }
    if (cobranca.status === StatusCobranca.EXPIRADA) {
      return { processado: false, motivo: 'COBRANCA_EXPIRADA' };
    }

    const conta = await this.contas.findOne({ where: { id: cobranca.contaBancariaId } });
    if (!conta?.credencialRef) {
      return { processado: false, motivo: 'SEM_CREDENCIAL' };
    }

    if (cobranca.modalidade === ModalidadeCobranca.PIX_COBV) {
      return this.verificarCobvInterno(cobranca, conta, eventoId);
    }
    return this.verificarV3Interno(cobranca, conta, eventoId);
  }

  private async verificarV3Interno(
    cobranca: CobrancaBoleto,
    conta: ContaBancaria,
    eventoId?: string,
  ) {
    const codigo = cobranca.idExterno!;
    const raw = await this.interCobranca.consultarCobranca(conta.credencialRef!, conta.conta, codigo);
    const consulta = normalizarConsultaCobrancaInter(codigo, raw);

    if (!cobrancaInterConsideradaPaga(consulta)) {
      return { processado: false, motivo: 'NAO_CONFIRMADO_NO_BANCO', situacao: consulta.situacao };
    }

    const comp = componentesBaixaDeCobranca(consulta);
    return this.executarBaixaAutomatica(cobranca, conta, comp, FormaPagamento.BOLETO, eventoId, codigo);
  }

  private async verificarCobvInterno(
    cobranca: CobrancaBoleto,
    conta: ContaBancaria,
    eventoId?: string,
  ) {
    const txid = cobranca.txid ?? cobranca.idExterno!;
    const raw = await this.interPixCobv.consultarCobv(conta.credencialRef!, conta.conta, txid);
    const consulta = normalizarConsultaCobvInter(txid, raw);

    if (cobvExpirada(consulta)) {
      cobranca.status = StatusCobranca.EXPIRADA;
      await this.cobrancas.save(cobranca);
      return { processado: true, motivo: 'MARCADA_EXPIRADA', cobrancaId: cobranca.id };
    }

    if (!cobvConsideradaPaga(consulta)) {
      return { processado: false, motivo: 'NAO_CONFIRMADO_NO_BANCO', situacao: consulta.status };
    }

    const comp = componentesBaixaDeCobv(consulta);
  const obs = `Baixa automática cobv ${txid}${comp.endToEndIds.length ? ` E2E ${comp.endToEndIds.join(',')}` : ''}`;
    return this.executarBaixaAutomatica(
      cobranca,
      conta,
      {
        valorPrincipal: comp.valorPrincipal,
        juros: comp.juros,
        multa: comp.multa,
        desconto: comp.desconto,
        valorRecebidoBruto: comp.valorRecebidoBruto,
        dataPagamento: comp.dataPagamento,
        observacaoExtra: obs,
      },
      FormaPagamento.PIX,
      eventoId,
      txid,
    );
  }

  private async executarBaixaAutomatica(
    cobranca: CobrancaBoleto,
    conta: ContaBancaria,
    comp: {
      valorPrincipal: number;
      juros: number;
      multa: number;
      desconto: number;
      valorRecebidoBruto: number;
      dataPagamento?: string | null;
      observacaoExtra?: string;
    },
    forma: FormaPagamento,
    eventoId: string | undefined,
    refExterna: string,
  ) {
    const tarifa = await this.tarifas.valorTarifa(conta.id, forma);
    const dataBaixa = comp.dataPagamento ?? new Date().toISOString().slice(0, 10);

    const dto: BaixarTituloDto = {
      conta_bancaria_id: conta.id,
      data_baixa: dataBaixa,
      valor_principal: comp.valorPrincipal,
      juros: comp.juros,
      multa: comp.multa,
      desconto: comp.desconto,
      tarifa,
      forma,
      observacao: comp.observacaoExtra ?? `Baixa automática ${refExterna}`,
    };

    const resultado = await this.baixas.baixarTituloReceberAutomatico(
      cobranca.tituloReceberId,
      cobranca.empresaId,
      dto,
      eventoId ?? `verificacao-${refExterna}-${dataBaixa}`,
    );

    cobranca.status = StatusCobranca.PAGA;
    cobranca.pagoEm = new Date();
    cobranca.valorPago = String(roundMoney(comp.valorRecebidoBruto));
    await this.cobrancas.save(cobranca);

    return {
      processado: true,
      cobrancaId: cobranca.id,
      baixaId: resultado.baixa.id,
      idempotente: (resultado as { idempotente?: boolean }).idempotente ?? false,
    };
  }

  async processarEventoWebhook(eventoId: string) {
    const evento = await this.eventos.findOne({ where: { id: eventoId } });
    if (!evento || evento.processado) return;

    evento.tentativas += 1;
    await this.eventos.save(evento);

    const txid = evento.payload.txid as string | undefined;
    const codigo = evento.payload.codigoSolicitacao as string | undefined;

    if (evento.tipoEvento === 'COBV_VERIFICAR' && txid) {
      try {
        const res = await this.verificarCobvPorTxid(txid, evento.id);
        await this.finalizarEvento(evento, res);
      } catch (err) {
        evento.erro = err instanceof Error ? err.message : 'ERRO_PROCESSAMENTO';
        await this.eventos.save(evento);
        this.logger.warn(`Webhook cobv ${eventoId}: ${evento.erro}`);
      }
      return;
    }

    if (!codigo) {
      evento.erro = 'SEM_REFERENCIA_COBRANCA_NO_PAYLOAD';
      evento.revisaoManual = true;
      await this.eventos.save(evento);
      return;
    }

    try {
      const res = await this.verificarCobrancaPorCodigo(codigo, evento.id);
      await this.finalizarEvento(evento, res);
    } catch (err) {
      evento.erro = err instanceof Error ? err.message : 'ERRO_PROCESSAMENTO';
      await this.eventos.save(evento);
      this.logger.warn(`Webhook ${eventoId}: ${evento.erro}`);
    }
  }

  private async finalizarEvento(
    evento: WebhookEvento,
    res: { processado: boolean; motivo?: string },
  ) {
    if (res.processado) {
      evento.processado = true;
      evento.processadoEm = new Date();
      evento.erro = null;
    } else if (res.motivo === 'NAO_CONFIRMADO_NO_BANCO') {
      evento.erro = res.motivo;
    } else {
      evento.erro = res.motivo ?? 'FALHA';
    }
    await this.eventos.save(evento);
  }
}