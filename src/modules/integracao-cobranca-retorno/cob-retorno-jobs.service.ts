import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CobRetornoService } from './cob-retorno.service';

@Injectable()
export class CobRetornoJobsService implements OnModuleInit {
  private timer?: NodeJS.Timeout;

  constructor(
    private config: ConfigService,
    private retorno: CobRetornoService,
  ) {}

  onModuleInit() {
    const ms = Number(this.config.get<string>('COB_RETORNO_POLL_MS') ?? 0);
    if (ms > 0) {
      this.timer = setInterval(() => void this.retorno.processarPendentes(), ms);
    }
  }
}