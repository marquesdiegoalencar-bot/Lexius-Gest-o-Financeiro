import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { IntegracaoCobrancaRetornoModule } from '../integracao-cobranca-retorno/integracao-cobranca-retorno.module';
import { Baixa } from '../../database/entities/baixa.entity';
import { ContaBancaria } from '../../database/entities/conta-bancaria.entity';
import { TituloPagar } from '../../database/entities/titulo-pagar.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { BaixasController } from './baixas.controller';
import { BaixasService } from './baixas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Baixa, TituloReceber, TituloPagar, ContaBancaria]),
    AuthModule,
    IntegracaoCobrancaRetornoModule,
  ],
  controllers: [BaixasController],
  providers: [BaixasService],
  exports: [BaixasService],
})
export class BaixasModule {}