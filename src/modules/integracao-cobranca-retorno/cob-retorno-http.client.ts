import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { cobAssinarMensagem } from '../../common/crypto/cob-hmac';

export type CobRetornoPostResult =
  | { ok: true; status: number }
  | { ok: false; status?: number; erro: string };

@Injectable()
export class CobRetornoHttpClient {
  private readonly logger = new Logger(CobRetornoHttpClient.name);

  constructor(private config: ConfigService) {}

  async postJson(rawBody: string): Promise<CobRetornoPostResult> {
    const urlStr = this.config.get<string>('COB_RETORNO_URL');
    if (!urlStr?.trim()) {
      return { ok: false, erro: 'COB_RETORNO_URL não configurada' };
    }

    const apiKey = this.config.get<string>('COB_RETORNO_API_KEY');
    const hmacSecret =
      this.config.get<string>('COB_RETORNO_HMAC_SECRET') ??
      this.config.get<string>('COB_INTEGRACAO_HMAC_SECRET');
    if (!apiKey || !hmacSecret) {
      return { ok: false, erro: 'Credenciais COB retorno ausentes' };
    }

    const timestamp = String(Math.floor(Date.now() / 1000));
    const assinatura = cobAssinarMensagem(hmacSecret, timestamp, rawBody);

    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;
    const timeoutMs = Number(this.config.get<string>('COB_RETORNO_TIMEOUT_MS') ?? 15_000);

    return new Promise((resolve) => {
      const req = lib.request(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(rawBody),
            'X-Api-Key': apiKey,
            'X-Timestamp': timestamp,
            'X-Signature': assinatura,
          },
          timeout: timeoutMs,
        },
        (res) => {
          res.resume();
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, status: res.statusCode });
          } else {
            resolve({
              ok: false,
              status: res.statusCode,
              erro: `HTTP ${res.statusCode ?? '?'}`,
            });
          }
        },
      );
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, erro: 'Timeout ao contactar COB' });
      });
      req.on('error', (err) => {
        this.logger.warn(`Falha HTTP COB: ${err.message}`);
        resolve({ ok: false, erro: err.message });
      });
      req.write(rawBody);
      req.end();
    });
  }
}