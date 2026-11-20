import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Anexo } from './entities/anexo.entity';
import { Auditoria } from './entities/auditoria.entity';
import { OrcamentoItem } from './entities/orcamento-item.entity';
import { OrcamentoVersao } from './entities/orcamento-versao.entity';
import { TituloAlocacaoDefinicao } from './entities/titulo-alocacao-definicao.entity';
import { TituloAlocacaoItem } from './entities/titulo-alocacao-item.entity';
import { TituloRateioVigencia } from './entities/titulo-rateio-vigencia.entity';
import { TituloRateioVigenciaItem } from './entities/titulo-rateio-vigencia-item.entity';
import { Baixa } from './entities/baixa.entity';
import { BaixaAlocacaoItem } from './entities/baixa-alocacao-item.entity';
import { Categoria } from './entities/categoria.entity';
import { CentroCusto } from './entities/centro-custo.entity';
import { Departamento } from './entities/departamento.entity';
import { CobrancaAcordo } from './entities/cobranca-acordo.entity';
import { CobrancaBoleto } from './entities/cobranca-boleto.entity';
import { CobrancaEmissaoPendente } from './entities/cobranca-emissao-pendente.entity';
import { CobRetornoEvento } from './entities/cob-retorno-evento.entity';
import { CredorRegraRepasse } from './entities/credor-regra-repasse.entity';
import { PagamentoBancario } from './entities/pagamento-bancario.entity';
import { PessoaDadosBancarios } from './entities/pessoa-dados-bancarios.entity';
import { RepasseItem } from './entities/repasse-item.entity';
import { Repasse } from './entities/repasse.entity';
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
import { SenhaResetToken } from './entities/senha-reset-token.entity';
import { Usuario } from './entities/usuario.entity';

const entities = [
  Empresa,
  Usuario,
  UsuarioEmpresa,
  SenhaResetToken,
  Pessoa,
  Categoria,
  CentroCusto,
  Departamento,
  ContaBancaria,
  CobrancaAcordo,
  TituloReceber,
  TituloPagar,
  Baixa,
  BaixaAlocacaoItem,
  TituloAlocacaoDefinicao,
  TituloAlocacaoItem,
  TituloRateioVigencia,
  TituloRateioVigenciaItem,
  OrcamentoVersao,
  OrcamentoItem,
  MovimentoBancario,
  Recorrencia,
  Anexo,
  Auditoria,
  OperacaoIntergrupo,
  CobrancaBoleto,
  CobrancaEmissaoPendente,
  CobRetornoEvento,
  Repasse,
  RepasseItem,
  CredorRegraRepasse,
  PessoaDadosBancarios,
  PagamentoBancario,
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