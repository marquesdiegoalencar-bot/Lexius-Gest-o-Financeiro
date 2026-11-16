import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

type TlsRequest = Request & {
  client?: { authorized?: boolean };
  socket?: { getPeerCertificate?: () => { subject?: unknown } };
};

@Injectable()
export class InterWebhookAuthGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<TlsRequest>();
    const nodeEnv = (this.config.get<string>('NODE_ENV') ?? 'development').toLowerCase();

    if (nodeEnv === 'production') {
      const tlsOk = req.client?.authorized === true;
      const cert = req.socket?.getPeerCertificate?.();
      if (!tlsOk) {
        throw new UnauthorizedException('Webhook Inter: certificado cliente inválido');
      }
      if (!cert?.subject) {
        throw new UnauthorizedException('Webhook Inter: mTLS não apresentado');
      }
      return true;
    }

    if (this.config.get<string>('INTER_USE_MOCK') === 'true') {
      const secret = this.config.get<string>('WEBHOOK_INTER_MOCK_SECRET');
      const header = req.headers['x-inter-mock-secret'];
      if (!secret || header !== secret) {
        throw new UnauthorizedException('Webhook mock: segredo inválido');
      }
      return true;
    }

    throw new UnauthorizedException('Webhook Inter indisponível fora de production ou mock');
  }
}