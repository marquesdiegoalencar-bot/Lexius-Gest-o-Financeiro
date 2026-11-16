import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as fs from 'fs';
import { URL, URLSearchParams } from 'url';
import { mascararParaLog } from '../../../common/utils/mascarar-dados';
import {
  INTER_API_BASE_PROD,
  INTER_API_BASE_SANDBOX,
  INTER_PATH_EXTRATO,
  INTER_PATH_SALDO,
  INTER_PATH_TOKEN,
} from './inter.constants';
import { CredenciaisBancoService, InterCredencialMaterial } from '../credenciais-banco.service';

type TokenCache = { token: string; expiraEm: number };

@Injectable()
export class InterHttpService {
  private readonly logger = new Logger(InterHttpService.name);
  private readonly tokens = new Map<string, TokenCache>();
  private readonly mockExtrato: unknown;
  private readonly mockSaldo: unknown;

  constructor(
    private config: ConfigService,
    private credenciais: CredenciaisBancoService,
  ) {
    this.mockExtrato = {
      transacoes: [
        {
          idTransacao: 'e2e-tx-001',
          dataEntrada: '2026-11-10',
          valor: '150.00',
          tipoTransacao: 'PIX',
          tipoOperacao: 'C',
          descricao: 'Recebimento Pix E2E',
          titulo: 'Recebimento Pix E2E',
        },
        {
          idTransacao: 'e2e-tx-002',
          dataEntrada: '2026-11-11',
          valor: '40.00',
          tipoTransacao: 'TARIFA',
          tipoOperacao: 'D',
          descricao: 'Tarifa E2E',
        },
      ],
    };
    this.mockSaldo = { disponivel: '12345.67', dataSaldo: '2026-11-11' };
  }

  private baseUrl(): string {
    const override = this.config.get<string>('INTER_API_BASE_URL');
    if (override) return override.replace(/\/$/, '');
    const sandbox = this.config.get<string>('INTER_SANDBOX') === 'true';
    return sandbox ? INTER_API_BASE_SANDBOX : INTER_API_BASE_PROD;
  }

  private mockMode(): boolean {
    return this.config.get<string>('INTER_USE_MOCK') === 'true';
  }

  private agent(material: InterCredencialMaterial): https.Agent | undefined {
    if (this.mockMode() || !material.certPath || !material.keyPath) {
      return undefined;
    }
    return new https.Agent({
      cert: fs.readFileSync(material.certPath),
      key: fs.readFileSync(material.keyPath),
      rejectUnauthorized: true,
    });
  }

  private requestJson<T>(
    method: string,
    path: string,
    material: InterCredencialMaterial,
    options?: { query?: Record<string, string>; body?: URLSearchParams; token?: string },
  ): Promise<T> {
    if (this.mockMode()) {
      return this.mockResponse<T>(method, path, options?.query);
    }

    const url = new URL(path.startsWith('http') ? path : `${this.baseUrl()}${path}`);
    if (options?.query) {
      for (const [k, v] of Object.entries(options.query)) {
        url.searchParams.set(k, v);
      }
    }

    return new Promise((resolve, reject) => {
      const body = options?.body ? options.body.toString() : undefined;
      const req = https.request(
        url,
        {
          method,
          agent: this.agent(material),
          headers: {
            ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
            ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            if (res.statusCode && res.statusCode >= 400) {
              this.logger.warn(
                `Inter HTTP ${res.statusCode} ${method} ${path}: ${mascararParaLog(raw.slice(0, 500))}`,
              );
              reject(new Error(`Inter HTTP ${res.statusCode}`));
              return;
            }
            try {
              resolve(JSON.parse(raw) as T);
            } catch {
              reject(new Error('Resposta Inter não é JSON'));
            }
          });
        },
      );
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  private mockResponse<T>(method: string, path: string, query?: Record<string, string>): Promise<T> {
    if (path.includes(INTER_PATH_TOKEN)) {
      return Promise.resolve({
        access_token: 'mock-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'extrato.read',
      } as T);
    }
    if (path.includes(INTER_PATH_SALDO)) {
      const data = { ...(this.mockSaldo as Record<string, string>) };
      if (query?.dataSaldo) data.dataSaldo = query.dataSaldo;
      return Promise.resolve(data as T);
    }
    if (path.includes(INTER_PATH_EXTRATO)) {
      return Promise.resolve(this.mockExtrato as T);
    }
    return Promise.reject(new Error(`Inter mock sem rota para ${method} ${path}`));
  }

  async obterToken(credencialRef: string, scopes: string[]): Promise<string> {
    const cacheKey = `${credencialRef}:${scopes.join(',')}`;
    const cached = this.tokens.get(cacheKey);
    if (cached && cached.expiraEm > Date.now() + 30_000) {
      return cached.token;
    }

    const material = this.credenciais.carregarInter(credencialRef);
    const body = new URLSearchParams({
      client_id: material.clientId,
      client_secret: material.clientSecret,
      grant_type: 'client_credentials',
      scope: scopes.join(' '),
    });

    const res = await this.requestJson<{ access_token: string; expires_in: number }>(
      'POST',
      INTER_PATH_TOKEN,
      material,
      { body },
    );

    const expiraEm = Date.now() + (res.expires_in ?? 3600) * 1000;
    this.tokens.set(cacheKey, { token: res.access_token, expiraEm });
    return res.access_token;
  }

  consultarSaldo(credencialRef: string, dataSaldo?: string): Promise<Record<string, unknown>> {
    return this.comBearer(credencialRef, ['extrato.read'], (token, material) => {
      const query: Record<string, string> = {};
      if (dataSaldo) query.dataSaldo = dataSaldo;
      return this.requestJson('GET', INTER_PATH_SALDO, material, { query, token });
    });
  }

  consultarExtrato(
    credencialRef: string,
    dataInicio: string,
    dataFim: string,
  ): Promise<Record<string, unknown>> {
    return this.comBearer(credencialRef, ['extrato.read'], (token, material) =>
      this.requestJson('GET', INTER_PATH_EXTRATO, material, {
        query: { dataInicio, dataFim },
        token,
      }),
    );
  }

  private async comBearer<T>(
    credencialRef: string,
    scopes: string[],
    fn: (token: string, material: InterCredencialMaterial) => Promise<T>,
  ): Promise<T> {
    const material = this.credenciais.carregarInter(credencialRef);
    const token = await this.obterToken(credencialRef, scopes);
    return fn(token, material);
  }
}