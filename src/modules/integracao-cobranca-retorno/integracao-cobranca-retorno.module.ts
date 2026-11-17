import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Baixa } from '../../database/entities/baixa.entity';
import { CobrancaAcordo } from '../../database/entities/cobranca-acordo.entity';
import { CobRetornoEvento } from '../../database/entities/cob-retorno-evento.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { CobRetornoController } from './cob-retorno.controller';
import { CobRetornoHttpClient } from './cob-retorno-http.client';
import { CobRetornoJobsService } from './cob-retorno-jobs.service';
import { CobRetornoService } from './cob-retorno.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CobRetornoEvento, Baixa, TituloReceber, CobrancaAcordo]),
    AuthModule,
  ],
  controllers: [CobRetornoController],
  providers: [CobRetornoService, CobRetornoHttpClient, CobRetornoJobsService],
  exports: [CobRetornoService],
})
export class IntegracaoCobrancaRetornoModule {}