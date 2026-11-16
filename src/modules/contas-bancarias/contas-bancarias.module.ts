import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ContaBancaria } from '../../database/entities/conta-bancaria.entity';
import { ContasBancariasController } from './contas-bancarias.controller';
import { ContasBancariasService } from './contas-bancarias.service';

@Module({
  imports: [TypeOrmModule.forFeature([ContaBancaria]), AuthModule],
  controllers: [ContasBancariasController],
  providers: [ContasBancariasService],
})
export class ContasBancariasModule {}