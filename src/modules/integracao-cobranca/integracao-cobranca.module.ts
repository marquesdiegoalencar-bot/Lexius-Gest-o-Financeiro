import { Module } from '@nestjs/common';
import { CobIntegracaoGuard } from '../../common/guards/cob-integracao.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CobrancaAcordo } from '../../database/entities/cobranca-acordo.entity';
import { Empresa } from '../../database/entities/empresa.entity';
import { Pessoa } from '../../database/entities/pessoa.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { CategoriasModule } from '../categorias/categorias.module';
import { IntegracaoCobrancaController } from './integracao-cobranca.controller';
import { IntegracaoCobrancaService } from './integracao-cobranca.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Empresa, CobrancaAcordo, Pessoa, TituloReceber]),
    CategoriasModule,
  ],
  controllers: [IntegracaoCobrancaController],
  providers: [IntegracaoCobrancaService, CobIntegracaoGuard],
})
export class IntegracaoCobrancaModule {}