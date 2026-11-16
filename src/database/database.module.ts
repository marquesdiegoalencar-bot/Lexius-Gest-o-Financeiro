import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CobrancaAcordo } from './entities/cobranca-acordo.entity';
import { Categoria } from './entities/categoria.entity';
import { CentroCusto } from './entities/centro-custo.entity';
import { ContaBancaria } from './entities/conta-bancaria.entity';
import { Empresa } from './entities/empresa.entity';
import { Pessoa } from './entities/pessoa.entity';
import { TituloReceber } from './entities/titulo-receber.entity';
import { UsuarioEmpresa } from './entities/usuario-empresa.entity';
import { Usuario } from './entities/usuario.entity';

const entities = [
  Empresa,
  Usuario,
  UsuarioEmpresa,
  Pessoa,
  Categoria,
  CentroCusto,
  ContaBancaria,
  CobrancaAcordo,
  TituloReceber,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        entities,
        synchronize: config.get<string>('DB_SYNC_SCHEMA') === 'true',
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),
    TypeOrmModule.forFeature(entities),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}