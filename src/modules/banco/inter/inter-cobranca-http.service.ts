import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { URL } from 'url';
import { mascararParaLog } from '../../../common/utils/mascarar-dados';
import { CredenciaisBancoService, InterCredencialMaterial } from '../credenciais-banco.service';
import { InterHttpService } from './inter-http.service';
import { INTER_API_BASE_PROD, INTER_API_BASE_SANDBOX } from './inter.constants';

type MockCobranca = {
  codigoSolicitacao: string;
  situacao: string;
  valorNominal: number;
  valorTotalRecebido: number | null;
  juros: number;
  multa: number;
  desconto: number;
  dataHoraSituacao: string;
  formaRecebimento?: string;
  seuNumero?: string;
};

@Injectable()
export class InterCobrancaHttpService {
  private readonly logger = new Logger(InterCobrancaHttpService.name);
  private readonly mockStore = new Map<string, MockCobranca>();

  constructor(
    private config: ConfigService,
    private credenciais: CredenciaisBancoService,
    private interHttp: InterHttpService,
  ) {}

  private cobrancaBase(): string {
    const override = this.config.get<string>('INTER_API_BASE_URL');
    const root = override
      ? override.replace(/\/$/, '')
      : this.config.get<string>('INTER_SANDBOX') === 'true'
        ? INTER_API_BASE_SANDBOX
        : INTER_API_BASE_PROD;
    return `${root}/cobranca/v3`;
  }

  private mockMode(): boolean {
    return this.config.get<string>('INTER_USE_MOCK') === 'true';
  }

  private agent(material: InterCredencialMaterial): https.Agent | undefined {
    if (this.mockMode() || !material.certPath) return undefined;
    return new https.Agent({
      cert: fs.readFileSync(material.certPath),
      key: fs.readFileSync(material.keyPath),
      rejectUnauthorized: true,
    });
  }

  private async token(ref: string): Promise<{ token: string; material: InterCredencialMaterial }> {
    const material = this.credenciais.carregarInter(ref);
    const token = await this.interHttp.obterToken(ref, [
      'boleto-cobranca.read',
      'boleto-cobranca.write',
    ]);
    return { token, material };
  }

  async emitirCobranca(
    credencialRef: string,
    contaCorrente: string | null,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.mockMode()) {
      const codigoSolicitacao = `mock-${randomUUID()}`;
      const valor = Number(body.valorNominal ?? 0);
      this.mockStore.set(codigoSolicitacao, {
        codigoSolicitacao,
        situacao: 'EMITIDA',
        valorNominal: valor,
        valorTotalRecebido: null,
        juros: 0,
        multa: 0,
        desconto: 0,
        dataHoraSituacao: new Date().toISOString(),
        seuNumero: String(body.seuNumero ?? ''),
      });
      return { codigoSolicitacao };
    }
    return this.requestJson('POST', '/cobrancas', credencialRef, contaCorrente, body);
  }

  async consultarCobranca(
    credencialRef: string,
    contaCorrente: string | null,
    codigoSolicitacao: string,
  ): Promise<Record<string, unknown>> {
    if (this.mockMode()) {
      const mock = this.mockStore.get(codigoSolicitacao);
      if (!mock) throw new Error('Cobrança mock não encontrada');
      return {
        cobranca: {
          codigoSolicitacao: mock.codigoSolicitacao,
          situacao: mock.situacao,
          valorNominal: mock.valorNominal,
          valorTotalRecebido: mock.valorTotalRecebido,
          juros: mock.juros,
          multa: mock.multa,
          desconto: mock.desconto,
          dataHoraSituacao: mock.dataHoraSituacao,
          formaRecebimento: mock.formaRecebimento,
          linhaDigitavel: '00000.00000 00000.000000 00000.000000 0 00000000000000',
          pixCopiaCola: '00020126580014br.gov.bcb.pix',
        },
      };
    }
    return this.requestJson('GET', `/cobrancas/${encodeURIComponent(codigoSolicitacao)}`, credencialRef, contaCorrente);
  }

  /** Sandbox: POST /cobrancas/{codigoSolicitacao}/pagar */
  simularPagamentoMock(
    codigoSolicitacao: string,
    opcoes: {
      valorTotalRecebido: number;
      juros?: number;
      multa?: number;
      desconto?: number;
      forma?: string;
    },
  ): void {
    const mock = this.mockStore.get(codigoSolicitacao);
    if (!mock) throw new Error('Cobrança mock não encontrada');
    mock.situacao = 'RECEBIDO';
    mock.valorTotalRecebido = opcoes.valorTotalRecebido;
    mock.juros = opcoes.juros ?? 0;
    mock.multa = opcoes.multa ?? 0;
    mock.desconto = opcoes.desconto ?? 0;
    mock.formaRecebimento = opcoes.forma ?? 'PIX';
    mock.dataHoraSituacao = new Date().toISOString();
  }

  listarCobrancasMockEmAberto(): string[] {
    return [...this.mockStore.entries()]
      .filter(([, v]) => v.situacao !== 'RECEBIDO' && v.situacao !== 'PAGO')
      .map(([k]) => k);
  }

  private requestJson(
    method: string,
    path: string,
    credencialRef: string,
    contaCorrente: string | null,
    jsonBody?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.token(credencialRef).then(({ token, material }) => {
      const url = new URL(`${this.cobrancaBase()}${path}`);
      const body = jsonBody ? JSON.stringify(jsonBody) : undefined;
      return new Promise((resolve, reject) => {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          ...(body
            ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) }
            : {}),
        };
        if (contaCorrente?.trim()) {
          headers['x-conta-corrente'] = contaCorrente.replace(/\D/g, '');
        }
        const req = https.request(
          url,
          { method, agent: this.agent(material), headers },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
              const raw = Buffer.concat(chunks).toString('utf8');
              if (res.statusCode && res.statusCode >= 400) {
                this.logger.warn(
                  `Inter Cobrança ${res.statusCode}: ${mascararParaLog(raw.slice(0, 400))}`,
                );
                reject(new Error(`Inter Cobrança HTTP ${res.statusCode}`));
                return;
              }
              try {
                resolve(JSON.parse(raw || '{}') as Record<string, unknown>);
              } catch {
                reject(new Error('Resposta cobrança inválida'));
              }
            });
          },
        );
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
      });
    });
  }
}