import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CobrancasModule } from '../cobrancas/cobrancas.module';
import { FinanceiroDimensoesModule } from '../../common/financeiro/financeiro-dimensoes.module';
import { RateioModule } from '../rateio/rateio.module';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { TitulosReceberController } from './titulos-receber.controller';
import { TitulosReceberService } from './titulos-receber.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TituloReceber]),
    AuthModule,
    CobrancasModule,
    FinanceiroDimensoesModule,
    RateioModule,
  ],
  controllers: [TitulosReceberController],
  providers: [TitulosReceberService],
  exports: [TitulosReceberService],
})
export class TitulosReceberModule {}