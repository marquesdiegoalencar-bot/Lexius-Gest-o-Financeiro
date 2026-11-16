import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

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

    const digest = createHmac('sha256', hmacSecret).update(rawBody).digest('hex');
    const assinaturaBuf = Buffer.from(assinatura, 'utf8');
    const digestBuf = Buffer.from(digest, 'utf8');
    if (assinaturaBuf.length !== digestBuf.length || !timingSafeEqual(assinaturaBuf, digestBuf)) {
      throw new UnauthorizedException('Assinatura HMAC inválida');
    }

    return true;
  }
}