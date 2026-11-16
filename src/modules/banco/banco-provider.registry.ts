import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ProvedorBancario } from '../../database/enums';
import { BancoProvider } from './banco-provider.types';
import { AsaasProvider } from './providers/asaas.provider';
import { C6Provider } from './providers/c6.provider';
import { InterProvider } from './providers/inter.provider';
import { ManualProvider } from './providers/manual.provider';

@Injectable()
export class BancoProviderRegistry {
  constructor(
    private manual: ManualProvider,
    private inter: InterProvider,
    private asaas: AsaasProvider,
    private c6: C6Provider,
  ) {}

  resolver(provedor: ProvedorBancario): BancoProvider {
    switch (provedor) {
      case ProvedorBancario.MANUAL:
      case ProvedorBancario.OUTRO:
        return this.manual;
      case ProvedorBancario.INTER:
        return this.inter;
      case ProvedorBancario.ASAAS:
        return this.asaas;
      case ProvedorBancario.C6:
        return this.c6;
      default:
        throw new UnprocessableEntityException(`Provedor bancário não suportado: ${provedor}`);
    }
  }
}