import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envValidation } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { CentrosCustoModule } from './modules/centros-custo/centros-custo.module';
import { ContasBancariasModule } from './modules/contas-bancarias/contas-bancarias.module';
import { EmpresasModule } from './modules/empresas/empresas.module';
import { IntegracaoCobrancaModule } from './modules/integracao-cobranca/integracao-cobranca.module';
import { PessoasModule } from './modules/pessoas/pessoas.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: envValidation,
    }),
    DatabaseModule,
    AuthModule,
    EmpresasModule,
    UsuariosModule,
    PessoasModule,
    CategoriasModule,
    CentrosCustoModule,
    ContasBancariasModule,
    IntegracaoCobrancaModule,
  ],
})
export class AppModule {}