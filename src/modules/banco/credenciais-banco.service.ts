import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { mascararRefCredencial } from '../../common/utils/mascarar-dados';

export type InterCredencialMaterial = {
  clientId: string;
  clientSecret: string;
  certPath: string;
  keyPath: string;
};

@Injectable()
export class CredenciaisBancoService {
  private readonly logger = new Logger(CredenciaisBancoService.name);

  constructor(private config: ConfigService) {}

  private envKey(ref: string, suffix: string): string {
    const norm = ref.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
    return `BANCO_CRED_${norm}_${suffix}`;
  }

  carregarInter(ref: string | null): InterCredencialMaterial {
    if (!ref?.trim()) {
      throw new UnprocessableEntityException(
        'Conta Inter sem credencial_ref; configure referência no cadastro e segredos no ambiente',
      );
    }
    if (this.config.get<string>('INTER_USE_MOCK') === 'true') {
      this.logger.log(`Inter credencial ${mascararRefCredencial(ref)} (modo mock)`);
      return {
        clientId: 'mock-client-id',
        clientSecret: 'mock-client-secret',
        certPath: '',
        keyPath: '',
      };
    }

    const clientId = this.config.get<string>(this.envKey(ref, 'CLIENT_ID'));
    const clientSecret = this.config.get<string>(this.envKey(ref, 'CLIENT_SECRET'));
    const certPath = this.config.get<string>(this.envKey(ref, 'CERT_PATH'));
    const keyPath = this.config.get<string>(this.envKey(ref, 'KEY_PATH'));

    if (!clientId || !clientSecret || !certPath || !keyPath) {
      throw new UnprocessableEntityException(
        `Credencial Inter não configurada para ref ${mascararRefCredencial(ref)}`,
      );
    }
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new UnprocessableEntityException(
        'Certificado ou chave mTLS não encontrados nos caminhos configurados',
      );
    }

    this.logger.log(`Credencial Inter carregada ref=${mascararRefCredencial(ref)}`);
    return { clientId, clientSecret, certPath, keyPath };
  }
}