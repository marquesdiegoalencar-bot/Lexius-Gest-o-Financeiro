import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CobrancaBoleto } from '../../database/entities/cobranca-boleto.entity';
import { ModalidadeCobranca, StatusCobranca } from '../../database/enums';
import { InterCobrancaHttpService } from '../banco/inter/inter-cobranca-http.service';
import { InterPixCobvHttpService } from '../banco/inter/inter-pix-cobv-http.service';
import { CobrancaVerificacaoService } from './cobranca-verificacao.service';
import { WebhooksInterService } from '../webhooks/webhooks-inter.service';

@Injectable()
export class CobrancaJobsService implements OnModuleInit {
  private readonly logger = new Logger(CobrancaJobsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private config: ConfigService,
    private verificacao: CobrancaVerificacaoService,
    private webhooks: WebhooksInterService,
    private interCobranca: InterCobrancaHttpService,
    private interPixCobv: InterPixCobvHttpService,
    @InjectRepository(CobrancaBoleto) private cobrancas: Repository<CobrancaBoleto>,
  ) {}

  onModuleInit() {
    const ms = Number(this.config.get<string>('COBRANCA_POLL_INTERVAL_MS') ?? 0);
    if (ms > 0) {
      this.timer = setInterval(() => void this.executarCiclo(), ms);
    }
  }

  async executarCiclo() {
    await this.webhooks.reprocessarPendentes();
    await this.consultarCobrancasAbertas();
  }

  private async consultarCobrancasAbertas() {
    const abertas = await this.cobrancas.find({
      where: {
        status: In([StatusCobranca.EMITIDA, StatusCobranca.REGISTRADA]),
      },
      take: 50,
    });
    for (const cb of abertas) {
      if (!cb.idExterno) continue;
      if (cb.modalidade === ModalidadeCobranca.PIX_COBV) {
        await this.verificacao.verificarCobvPorTxid(cb.txid ?? cb.idExterno);
      } else {
        await this.verificacao.verificarCobrancaPorCodigo(cb.idExterno);
      }
    }

    if (this.config.get<string>('INTER_USE_MOCK') === 'true') {
      for (const txid of this.interPixCobv.listarCobvMockEmAberto()) {
        await this.verificacao.verificarCobvPorTxid(txid);
      }
      for (const codigo of this.interCobranca.listarCobrancasMockEmAberto()) {
        await this.verificacao.verificarCobrancaPorCodigo(codigo);
      }
    }
  }
}