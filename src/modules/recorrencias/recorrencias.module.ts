import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Recorrencia } from '../../database/entities/recorrencia.entity';
import { TituloPagar } from '../../database/entities/titulo-pagar.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { RecorrenciasController } from './recorrencias.controller';
import { RecorrenciasService } from './recorrencias.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Recorrencia, TituloReceber, TituloPagar]),
    AuthModule,
  ],
  controllers: [RecorrenciasController],
  providers: [RecorrenciasService],
})
export class RecorrenciasModule {}