import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { BaixaAlocacaoItem } from '../../database/entities/baixa-alocacao-item.entity';
import { Categoria } from '../../database/entities/categoria.entity';
import { TituloRateioVigencia } from '../../database/entities/titulo-rateio-vigencia.entity';
import { TituloRateioVigenciaItem } from '../../database/entities/titulo-rateio-vigencia-item.entity';
import { Empresa } from '../../database/entities/empresa.entity';
import { DreController } from './dre.controller';
import { DreService } from './dre.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BaixaAlocacaoItem,
      Categoria,
      TituloRateioVigencia,
      TituloRateioVigenciaItem,
      Empresa,
    ]),
    AuthModule,
  ],
  controllers: [DreController],
  providers: [DreService],
  exports: [DreService],
})
export class DreModule {}