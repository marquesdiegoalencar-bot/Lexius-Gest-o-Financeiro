import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CobrancaBoleto } from '../../database/entities/cobranca-boleto.entity';
import { StatusCobranca } from '../../database/enums';
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
      where: [{ status: StatusCobranca.EMITIDA }, { status: StatusCobranca.REGISTRADA }],
      take: 50,
    });
    for (const cb of abertas) {
      if (!cb.idExterno) continue;
      await this.verificacao.verificarCobrancaPorCodigo(cb.idExterno);
    }
  }
}