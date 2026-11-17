import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Anexo } from './entities/anexo.entity';
import { Auditoria } from './entities/auditoria.entity';
import { Baixa } from './entities/baixa.entity';
import { Categoria } from './entities/categoria.entity';
import { CentroCusto } from './entities/centro-custo.entity';
import { CobrancaAcordo } from './entities/cobranca-acordo.entity';
import { CobrancaBoleto } from './entities/cobranca-boleto.entity';
import { CobrancaEmissaoPendente } from './entities/cobranca-emissao-pendente.entity';
import { ContaTarifaCobranca } from './entities/conta-tarifa-cobranca.entity';
import { WebhookEvento } from './entities/webhook-evento.entity';
import { ContaBancaria } from './entities/conta-bancaria.entity';
import { Empresa } from './entities/empresa.entity';
import { MovimentoBancario } from './entities/movimento-bancario.entity';
import { OperacaoIntergrupo } from './entities/operacao-intergrupo.entity';
import { Pessoa } from './entities/pessoa.entity';
import { Recorrencia } from './entities/recorrencia.entity';
import { TituloPagar } from './entities/titulo-pagar.entity';
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
  TituloPagar,
  Baixa,
  MovimentoBancario,
  Recorrencia,
  Anexo,
  Auditoria,
  OperacaoIntergrupo,
  CobrancaBoleto,
  CobrancaEmissaoPendente,
  WebhookEvento,
  ContaTarifaCobranca,
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