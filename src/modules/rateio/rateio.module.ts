import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceiroDimensoesModule } from '../../common/financeiro/financeiro-dimensoes.module';
import { AuthModule } from '../auth/auth.module';
import { BaixaAlocacaoItem } from '../../database/entities/baixa-alocacao-item.entity';
import { TituloAlocacaoDefinicao } from '../../database/entities/titulo-alocacao-definicao.entity';
import { TituloAlocacaoItem } from '../../database/entities/titulo-alocacao-item.entity';
import { TituloRateioVigencia } from '../../database/entities/titulo-rateio-vigencia.entity';
import { TituloRateioVigenciaItem } from '../../database/entities/titulo-rateio-vigencia-item.entity';
import { Empresa } from '../../database/entities/empresa.entity';
import { TituloPagar } from '../../database/entities/titulo-pagar.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { RateioBaixaService } from './rateio-baixa.service';
import { RateioController } from './rateio.controller';
import { RateioService } from './rateio.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TituloAlocacaoDefinicao,
      TituloAlocacaoItem,
      TituloRateioVigencia,
      TituloRateioVigenciaItem,
      BaixaAlocacaoItem,
      TituloReceber,
      TituloPagar,
      Empresa,
    ]),
    AuthModule,
    FinanceiroDimensoesModule,
  ],
  controllers: [RateioController],
  providers: [RateioService, RateioBaixaService],
  exports: [RateioService, RateioBaixaService],
})
export class RateioModule {}