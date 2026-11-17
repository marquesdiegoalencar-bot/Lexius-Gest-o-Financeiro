import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { cobVerificarAssinatura } from '../crypto/cob-hmac';

@Injectable()
export class CobIntegracaoGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const apiKey = req.headers['x-api-key'];
    const assinatura = req.headers['x-signature'];

    const esperadaKey = this.config.get<string>('COB_INTEGRACAO_API_KEY');
    const hmacSecret = this.config.get<string>('COB_INTEGRACAO_HMAC_SECRET');

    if (
      typeof apiKey !== 'string' ||
      typeof assinatura !== 'string' ||
      !esperadaKey ||
      !hmacSecret
    ) {
      throw new UnauthorizedException('Credenciais de integração inválidas');
    }

    const keyA = Buffer.from(apiKey);
    const keyB = Buffer.from(esperadaKey);
    if (keyA.length !== keyB.length || !timingSafeEqual(keyA, keyB)) {
      throw new UnauthorizedException('API key inválida');
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      throw new UnauthorizedException('Corpo da requisição indisponível para HMAC');
    }

    const tsHeader = req.headers['x-timestamp'];
    const maxSkew = Number(this.config.get<string>('COB_INTEGRACAO_HMAC_MAX_SKEW_SECONDS') ?? 300);
    const verificacao = cobVerificarAssinatura({
      secret: hmacSecret,
      rawBody: rawBody.toString('utf8'),
      assinatura,
      timestampHeader: typeof tsHeader === 'string' ? tsHeader : null,
      maxSkewSec: maxSkew,
    });
    if (!verificacao.ok) {
      throw new UnauthorizedException(verificacao.motivo);
    }

    return true;
  }
}