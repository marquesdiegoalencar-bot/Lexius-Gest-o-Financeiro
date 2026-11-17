import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Baixa } from '../../database/entities/baixa.entity';
import { ContaBancaria } from '../../database/entities/conta-bancaria.entity';
import { CredorRegraRepasse } from '../../database/entities/credor-regra-repasse.entity';
import { Pessoa } from '../../database/entities/pessoa.entity';
import { RepasseItem } from '../../database/entities/repasse-item.entity';
import { Repasse } from '../../database/entities/repasse.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { CredoresRepasseController } from './credores-repasse.controller';
import { RepassesController } from './repasses.controller';
import { RepassesService } from './repasses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Repasse,
      RepasseItem,
      Baixa,
      TituloReceber,
      Pessoa,
      ContaBancaria,
      CredorRegraRepasse,
    ]),
    AuthModule,
  ],
  controllers: [RepassesController, CredoresRepasseController],
  providers: [RepassesService],
  exports: [RepassesService],
})
export class RepassesModule {}