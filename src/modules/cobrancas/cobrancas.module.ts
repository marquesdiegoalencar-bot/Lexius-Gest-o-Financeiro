import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CobrancaBoleto } from '../../database/entities/cobranca-boleto.entity';
import { ContaBancaria } from '../../database/entities/conta-bancaria.entity';
import { Pessoa } from '../../database/entities/pessoa.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { WebhookEvento } from '../../database/entities/webhook-evento.entity';
import { BancoModule } from '../banco/banco.module';
import { BaixasModule } from '../baixas/baixas.module';
import { TarifasCobrancaModule } from '../tarifas-cobranca/tarifas-cobranca.module';
import { InterWebhookAuthGuard } from '../webhooks/inter-webhook-auth.guard';
import { WebhooksInterController } from '../webhooks/webhooks-inter.controller';
import { WebhooksInterService } from '../webhooks/webhooks-inter.service';
import { CobrancaJobsService } from './cobranca-jobs.service';
import { CobrancaVerificacaoService } from './cobranca-verificacao.service';
import { CobrancasController } from './cobrancas.controller';
import { CobrancasService } from './cobrancas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CobrancaBoleto, TituloReceber, ContaBancaria, Pessoa, WebhookEvento]),
    BancoModule,
    BaixasModule,
    TarifasCobrancaModule,
  ],
  controllers: [CobrancasController, WebhooksInterController],
  providers: [
    CobrancasService,
    CobrancaVerificacaoService,
    CobrancaJobsService,
    WebhooksInterService,
    InterWebhookAuthGuard,
  ],
  exports: [CobrancasService, CobrancaVerificacaoService],
})
export class CobrancasModule {}