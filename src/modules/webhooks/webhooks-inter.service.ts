import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookEvento } from '../../database/entities/webhook-evento.entity';
import { ProvedorBancario } from '../../database/enums';
import { parseWebhookCallbackCobranca } from '../banco/inter/inter-webhook-callback.mapper';
import { parseWebhookCallbackPix } from '../banco/inter/inter-webhook-pix.mapper';
import { CobrancaVerificacaoService } from '../cobrancas/cobranca-verificacao.service';

@Injectable()
export class WebhooksInterService {
  private readonly logger = new Logger(WebhooksInterService.name);

  constructor(
    @InjectRepository(WebhookEvento) private eventos: Repository<WebhookEvento>,
    private verificacao: CobrancaVerificacaoService,
  ) {}

  async receber(payload: Record<string, unknown>, assinaturaValida: boolean) {
    const pix = parseWebhookCallbackPix(payload);
    const v3 = pix.ok ? null : parseWebhookCallbackCobranca(payload);

    if (!pix.ok && !v3?.ok) {
      const eventoIdExterno = pix.eventoIdExterno || v3?.eventoIdExterno || 'desconhecido';
      const motivo = [pix.ok ? '' : pix.motivo, v3?.ok ? '' : v3?.motivo].filter(Boolean).join('; ');
      const evento = await this.eventos.save(
        this.eventos.create({
          provedor: ProvedorBancario.INTER,
          eventoIdExterno,
          tipoEvento: 'COBRANCA_DESCONHECIDO',
          payload,
          assinaturaValida,
          revisaoManual: true,
          erro: motivo,
        }),
      );
      this.logger.warn(`Webhook revisão manual ${evento.id}: ${motivo}`);
      return { recebido: true, revisao_manual: true };
    }

    if (pix.ok) {
      return this.persistirEAgendar({
        tipoEvento: 'COBV_VERIFICAR',
        eventoIdExterno: pix.eventoIdExterno,
        payload: { ...payload, txid: pix.txid },
        assinaturaValida,
      });
    }

    if (!v3?.ok) {
      return { recebido: true, revisao_manual: true };
    }
    return this.persistirEAgendar({
      tipoEvento: 'COBRANCA_VERIFICAR',
      eventoIdExterno: v3.eventoIdExterno,
      payload: { ...payload, codigoSolicitacao: v3.codigoSolicitacao },
      assinaturaValida,
    });
  }

  private async persistirEAgendar(params: {
    tipoEvento: string;
    eventoIdExterno: string;
    payload: Record<string, unknown>;
    assinaturaValida: boolean;
  }) {
    const existente = await this.eventos.findOne({
      where: { provedor: ProvedorBancario.INTER, eventoIdExterno: params.eventoIdExterno },
    });
    if (existente) {
      if (!existente.processado && !existente.revisaoManual) {
        setImmediate(() => void this.verificacao.processarEventoWebhook(existente.id));
      }
      return { recebido: true, duplicado: true };
    }

    const evento = await this.eventos.save(
      this.eventos.create({
        provedor: ProvedorBancario.INTER,
        eventoIdExterno: params.eventoIdExterno,
        tipoEvento: params.tipoEvento,
        payload: params.payload,
        assinaturaValida: params.assinaturaValida,
      }),
    );

    setImmediate(() => void this.verificacao.processarEventoWebhook(evento.id));
    return { recebido: true, evento_id: evento.id };
  }

  async reprocessarPendentes(limit = 20) {
    const pendentes = await this.eventos.find({
      where: { provedor: ProvedorBancario.INTER, processado: false, revisaoManual: false },
      take: limit,
      order: { recebidoEm: 'ASC' },
    });
    for (const ev of pendentes) {
      await this.verificacao.processarEventoWebhook(ev.id);
    }
    return { processados: pendentes.length };
  }
}