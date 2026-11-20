import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceiroDimensoesModule } from '../../common/financeiro/financeiro-dimensoes.module';
import { AuthModule } from '../auth/auth.module';
import { RateioModule } from '../rateio/rateio.module';
import { Recorrencia } from '../../database/entities/recorrencia.entity';
import { TituloPagar } from '../../database/entities/titulo-pagar.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { RecorrenciasController } from './recorrencias.controller';
import { RecorrenciasService } from './recorrencias.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Recorrencia, TituloReceber, TituloPagar]),
    AuthModule,
    FinanceiroDimensoesModule,
    RateioModule,
  ],
  controllers: [RecorrenciasController],
  providers: [RecorrenciasService],
})
export class RecorrenciasModule {}