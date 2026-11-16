import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Pessoa } from '../../database/entities/pessoa.entity';
import { PessoasController } from './pessoas.controller';
import { PessoasService } from './pessoas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Pessoa]), AuthModule],
  controllers: [PessoasController],
  providers: [PessoasService],
  exports: [PessoasService],
})
export class PessoasModule {}