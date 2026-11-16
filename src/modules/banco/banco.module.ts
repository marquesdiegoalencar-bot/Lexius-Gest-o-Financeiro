import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContaBancaria } from '../../database/entities/conta-bancaria.entity';
import { MovimentoBancario } from '../../database/entities/movimento-bancario.entity';
import { BancoProviderRegistry } from './banco-provider.registry';
import { CredenciaisBancoService } from './credenciais-banco.service';
import { ExtratoSincronizacaoService } from './extrato-sincronizacao.service';
import { InterHttpService } from './inter/inter-http.service';
import { AsaasProvider } from './providers/asaas.provider';
import { C6Provider } from './providers/c6.provider';
import { InterProvider } from './providers/inter.provider';
import { ManualProvider } from './providers/manual.provider';

@Module({
  imports: [TypeOrmModule.forFeature([MovimentoBancario, ContaBancaria])],
  providers: [
    CredenciaisBancoService,
    InterHttpService,
    ManualProvider,
    InterProvider,
    AsaasProvider,
    C6Provider,
    BancoProviderRegistry,
    ExtratoSincronizacaoService,
  ],
  exports: [
    BancoProviderRegistry,
    ExtratoSincronizacaoService,
    CredenciaisBancoService,
  ],
})
export class BancoModule {}