import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Empresa } from '../../database/entities/empresa.entity';
import { OperacaoIntergrupo } from '../../database/entities/operacao-intergrupo.entity';
import { IntergrupoController } from './intergrupo.controller';
import { IntergrupoService } from './intergrupo.service';

@Module({
  imports: [TypeOrmModule.forFeature([OperacaoIntergrupo, Empresa]), AuthModule],
  controllers: [IntergrupoController],
  providers: [IntergrupoService],
})
export class IntergrupoModule {}