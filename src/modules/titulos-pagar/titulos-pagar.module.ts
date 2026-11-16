import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { TituloPagar } from '../../database/entities/titulo-pagar.entity';
import { TitulosPagarController } from './titulos-pagar.controller';
import { TitulosPagarService } from './titulos-pagar.service';

@Module({
  imports: [TypeOrmModule.forFeature([TituloPagar]), AuthModule],
  controllers: [TitulosPagarController],
  providers: [TitulosPagarService],
  exports: [TitulosPagarService],
})
export class TitulosPagarModule {}