import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { TituloPagar } from '../../database/entities/titulo-pagar.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { RelatoriosController } from './relatorios.controller';
import { RelatoriosService } from './relatorios.service';

@Module({
  imports: [TypeOrmModule.forFeature([TituloReceber, TituloPagar]), AuthModule],
  controllers: [RelatoriosController],
  providers: [RelatoriosService],
})
export class RelatoriosModule {}