import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceiroDimensoesModule } from '../../common/financeiro/financeiro-dimensoes.module';
import { AuthModule } from '../auth/auth.module';
import { DreModule } from '../dre/dre.module';
import { Categoria } from '../../database/entities/categoria.entity';
import { OrcamentoItem } from '../../database/entities/orcamento-item.entity';
import { OrcamentoVersao } from '../../database/entities/orcamento-versao.entity';
import { OrcamentoController } from './orcamento.controller';
import { OrcamentoService } from './orcamento.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrcamentoVersao, OrcamentoItem, Categoria]),
    AuthModule,
    FinanceiroDimensoesModule,
    DreModule,
  ],
  controllers: [OrcamentoController],
  providers: [OrcamentoService],
  exports: [OrcamentoService],
})
export class OrcamentoModule {}