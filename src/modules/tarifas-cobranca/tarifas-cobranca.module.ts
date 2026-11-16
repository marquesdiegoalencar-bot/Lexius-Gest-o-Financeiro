import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContaTarifaCobranca } from '../../database/entities/conta-tarifa-cobranca.entity';
import { TarifasCobrancaService } from './tarifas-cobranca.service';

@Module({
  imports: [TypeOrmModule.forFeature([ContaTarifaCobranca])],
  providers: [TarifasCobrancaService],
  exports: [TarifasCobrancaService],
})
export class TarifasCobrancaModule {}