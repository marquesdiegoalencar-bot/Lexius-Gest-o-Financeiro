import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditoriaModule } from './common/auditoria/auditoria.module';
import { StorageModule } from './common/storage/storage.module';
import { envValidation } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AnexosModule } from './modules/anexos/anexos.module';
import { AuthModule } from './modules/auth/auth.module';
import { BaixasModule } from './modules/baixas/baixas.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { CentrosCustoModule } from './modules/centros-custo/centros-custo.module';
import { ContasBancariasModule } from './modules/contas-bancarias/contas-bancarias.module';
import { EmpresasModule } from './modules/empresas/empresas.module';
import { IntegracaoCobrancaModule } from './modules/integracao-cobranca/integracao-cobranca.module';
import { IntergrupoModule } from './modules/intergrupo/intergrupo.module';
import { PessoasModule } from './modules/pessoas/pessoas.module';
import { RecorrenciasModule } from './modules/recorrencias/recorrencias.module';
import { RelatoriosModule } from './modules/relatorios/relatorios.module';
import { TitulosPagarModule } from './modules/titulos-pagar/titulos-pagar.module';
import { TitulosReceberModule } from './modules/titulos-receber/titulos-receber.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: envValidation,
    }),
    DatabaseModule,
    AuditoriaModule,
    StorageModule,
    AuthModule,
    EmpresasModule,
    UsuariosModule,
    PessoasModule,
    CategoriasModule,
    CentrosCustoModule,
    ContasBancariasModule,
    IntegracaoCobrancaModule,
    TitulosReceberModule,
    TitulosPagarModule,
    BaixasModule,
    RecorrenciasModule,
    AnexosModule,
    IntergrupoModule,
    RelatoriosModule,
  ],
})
export class AppModule {}