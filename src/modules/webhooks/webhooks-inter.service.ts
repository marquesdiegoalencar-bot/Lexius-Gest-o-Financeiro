import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookEvento } from '../../database/entities/webhook-evento.entity';
import { ProvedorBancario } from '../../database/enums';
import { parseWebhookCallbackCobranca } from '../banco/inter/inter-webhook-callback.mapper';
import { CobrancaVerificacaoService } from '../cobrancas/cobranca-verificacao.service';

@Injectable()
export class WebhooksInterService {
  private readonly logger = new Logger(WebhooksInterService.name);

  constructor(
    @InjectRepository(WebhookEvento) private eventos: Repository<WebhookEvento>,
    private verificacao: CobrancaVerificacaoService,
  ) {}

  async receber(payload: Record<string, unknown>, assinaturaValida: boolean) {
    const parsed = parseWebhookCallbackCobranca(payload);

    if (!parsed.ok) {
      const evento = await this.eventos.save(
        this.eventos.create({
          provedor: ProvedorBancario.INTER,
          eventoIdExterno: parsed.eventoIdExterno,
          tipoEvento: 'COBRANCA_DESCONHECIDO',
          payload,
          assinaturaValida,
          revisaoManual: true,
          erro: parsed.motivo,
        }),
      );
      this.logger.warn(`Webhook revisão manual ${evento.id}: ${parsed.motivo}`);
      return { recebido: true, revisao_manual: true };
    }

    const existente = await this.eventos.findOne({
      where: { provedor: ProvedorBancario.INTER, eventoIdExterno: parsed.eventoIdExterno },
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
        eventoIdExterno: parsed.eventoIdExterno,
        tipoEvento: 'COBRANCA_VERIFICAR',
        payload: { ...payload, codigoSolicitacao: parsed.codigoSolicitacao },
        assinaturaValida,
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