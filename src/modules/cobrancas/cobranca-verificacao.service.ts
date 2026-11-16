import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { roundMoney } from '../../common/utils/money';
import { CobrancaBoleto } from '../../database/entities/cobranca-boleto.entity';
import { ContaBancaria } from '../../database/entities/conta-bancaria.entity';
import { WebhookEvento } from '../../database/entities/webhook-evento.entity';
import { FormaPagamento, StatusCobranca } from '../../database/enums';
import { InterCobrancaHttpService } from '../banco/inter/inter-cobranca-http.service';
import {
  cobrancaInterConsideradaPaga,
  componentesBaixaDeCobranca,
  normalizarConsultaCobrancaInter,
} from '../banco/inter/inter-cobranca.mapper';
import { BaixasService } from '../baixas/baixas.service';
import { BaixarTituloDto } from '../baixas/dto/baixar-titulo.dto';
import { TarifasCobrancaService } from '../tarifas-cobranca/tarifas-cobranca.service';

@Injectable()
export class CobrancaVerificacaoService {
  private readonly logger = new Logger(CobrancaVerificacaoService.name);

  constructor(
    private interCobranca: InterCobrancaHttpService,
    private baixas: BaixasService,
    private tarifas: TarifasCobrancaService,
    @InjectRepository(CobrancaBoleto) private cobrancas: Repository<CobrancaBoleto>,
    @InjectRepository(ContaBancaria) private contas: Repository<ContaBancaria>,
    @InjectRepository(WebhookEvento) private eventos: Repository<WebhookEvento>,
  ) {}

  async verificarCobrancaPorCodigo(codigoSolicitacao: string, eventoId?: string) {
    const cobranca = await this.cobrancas.findOne({
      where: { idExterno: codigoSolicitacao },
    });
    if (!cobranca) {
      return { processado: false, motivo: 'COBRANCA_NAO_ENCONTRADA' };
    }
    if (cobranca.status === StatusCobranca.PAGA) {
      return { processado: true, motivo: 'JA_PAGA', cobrancaId: cobranca.id };
    }

    const conta = await this.contas.findOne({ where: { id: cobranca.contaBancariaId } });
    if (!conta?.credencialRef) {
      return { processado: false, motivo: 'SEM_CREDENCIAL' };
    }

    const raw = await this.interCobranca.consultarCobranca(
      conta.credencialRef,
      conta.conta,
      codigoSolicitacao,
    );
    const consulta = normalizarConsultaCobrancaInter(codigoSolicitacao, raw);

    if (!cobrancaInterConsideradaPaga(consulta)) {
      return { processado: false, motivo: 'NAO_CONFIRMADO_NO_BANCO', situacao: consulta.situacao };
    }

  const comp = componentesBaixaDeCobranca(consulta);
    const forma =
      String(consulta.formaRecebimento ?? '').toUpperCase() === 'PIX'
        ? FormaPagamento.PIX
        : FormaPagamento.BOLETO;
    const tarifa = await this.tarifas.valorTarifa(conta.id, forma);
    const dataBaixa = consulta.dataPagamento ?? new Date().toISOString().slice(0, 10);

    const dto: BaixarTituloDto = {
      conta_bancaria_id: conta.id,
      data_baixa: dataBaixa,
      valor_principal: comp.valorPrincipal,
      juros: comp.juros,
      multa: comp.multa,
      desconto: comp.desconto,
      tarifa,
      forma,
      observacao: `Baixa automática cobrança ${codigoSolicitacao}`,
    };

    const eventoWebhooks = eventoId;
    const resultado = await this.baixas.baixarTituloReceberAutomatico(
      cobranca.tituloReceberId,
      cobranca.empresaId,
      dto,
      eventoWebhooks ?? `verificacao-${codigoSolicitacao}-${dataBaixa}`,
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

    const codigo = evento.payload.codigoSolicitacao as string | undefined;
    if (!codigo) {
      evento.erro = 'SEM_CODIGO_SOLICITACAO_NO_PAYLOAD';
      evento.revisaoManual = true;
      await this.eventos.save(evento);
      return;
    }

    try {
      const res = await this.verificarCobrancaPorCodigo(codigo, evento.id);
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
    } catch (err) {
      evento.erro = err instanceof Error ? err.message : 'ERRO_PROCESSAMENTO';
      await this.eventos.save(evento);
      this.logger.warn(`Webhook ${eventoId}: ${evento.erro}`);
    }
  }
}