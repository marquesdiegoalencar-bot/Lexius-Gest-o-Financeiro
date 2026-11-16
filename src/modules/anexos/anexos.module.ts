import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Anexo } from '../../database/entities/anexo.entity';
import { AnexosController } from './anexos.controller';
import { AnexosService } from './anexos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Anexo]), AuthModule],
  controllers: [AnexosController],
  providers: [AnexosService],
})
export class AnexosModule {}