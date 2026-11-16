import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { TitulosReceberController } from './titulos-receber.controller';
import { TitulosReceberService } from './titulos-receber.service';

@Module({
  imports: [TypeOrmModule.forFeature([TituloReceber]), AuthModule],
  controllers: [TitulosReceberController],
  providers: [TitulosReceberService],
  exports: [TitulosReceberService],
})
export class TitulosReceberModule {}