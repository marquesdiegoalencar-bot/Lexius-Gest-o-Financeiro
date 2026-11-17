import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as fs from 'fs';
import { URL } from 'url';
import { mascararParaLog } from '../../../common/utils/mascarar-dados';
import { CredenciaisBancoService, InterCredencialMaterial } from '../credenciais-banco.service';
import { InterHttpService } from './inter-http.service';
import {
  INTER_API_BASE_PROD,
  INTER_API_BASE_SANDBOX,
  interPixPathCobv,
  interPixPathCobvPagamentoSandbox,
  interPixPathWebhook,
} from './inter.constants';
import type { CobvPixRecebido } from './inter-pix-cobv.mapper';

type MockCobv = {
  txid: string;
  status: string;
  valorOriginal: number;
  dataDeVencimento: string;
  validadeAposVencimento: number;
  pixCopiaECola: string;
  pixRecebidos: CobvPixRecebido[];
};

@Injectable()
export class InterPixCobvHttpService {
  private readonly logger = new Logger(InterPixCobvHttpService.name);
  private readonly mockStore = new Map<string, MockCobv>();
  /** Contador de falhas simuladas na emissão (somente mock / testes). */
  private mockEmitirFalhasRestantes = 0;

  constructor(
    private config: ConfigService,
    private credenciais: CredenciaisBancoService,
    private interHttp: InterHttpService,
  ) {}

  private apiRoot(): string {
    const override = this.config.get<string>('INTER_API_BASE_URL');
    if (override) return override.replace(/\/$/, '');
    return this.config.get<string>('INTER_SANDBOX') === 'true'
      ? INTER_API_BASE_SANDBOX
      : INTER_API_BASE_PROD;
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
      'cobv.read',
      'cobv.write',
      'webhook.read',
      'webhook.write',
      'pix.write',
    ]);
    return { token, material };
  }

  simularFalhasEmissaoMock(quantidade: number): void {
    if (!this.mockMode()) return;
    this.mockEmitirFalhasRestantes = Math.max(0, quantidade);
  }

  async criarCobv(
    credencialRef: string,
    contaCorrente: string | null,
    txid: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (this.mockMode()) {
      if (this.mockEmitirFalhasRestantes > 0) {
        this.mockEmitirFalhasRestantes -= 1;
        throw new Error('MOCK_FALHA_EMISSAO_COBRANCA');
      }
      const cal = (body.calendario ?? {}) as Record<string, unknown>;
      const valor = (body.valor ?? {}) as Record<string, unknown>;
      const venc = String(cal.dataDeVencimento ?? '');
      this.mockStore.set(txid, {
        txid,
        status: 'ATIVA',
        valorOriginal: Number(valor.original ?? 0),
        dataDeVencimento: venc,
        validadeAposVencimento: Number(cal.validadeAposVencimento ?? 30),
        pixCopiaECola: `00020126580014br.gov.bcb.pixMOCK-COBV-${txid}`,
        pixRecebidos: [],
      });
      return { txid, status: 'ATIVA', ...body };
    }
    return this.requestJson('PUT', interPixPathCobv(txid), credencialRef, contaCorrente, body);
  }

  async consultarCobv(
    credencialRef: string,
    contaCorrente: string | null,
    txid: string,
  ): Promise<Record<string, unknown>> {
    if (this.mockMode()) {
      const mock = this.mockStore.get(txid);
      if (!mock) throw new Error('Cobv mock não encontrada');
      return {
        txid: mock.txid,
        status: mock.status,
        calendario: {
          dataDeVencimento: mock.dataDeVencimento,
          validadeAposVencimento: mock.validadeAposVencimento,
        },
        valor: { original: mock.valorOriginal.toFixed(2) },
        pixCopiaECola: mock.pixCopiaECola,
        pix: mock.pixRecebidos.map((p) => ({
          endToEndId: p.endToEndId,
          txid: mock.txid,
          valor: p.valor.toFixed(2),
          horario: `${p.horario}T12:00:00Z`,
          componentesValor: {
            original: { valor: p.valorPrincipal.toFixed(2) },
            juros: { valor: p.juros.toFixed(2) },
            multa: { valor: p.multa.toFixed(2) },
            abatimento: { valor: p.desconto.toFixed(2) },
          },
        })),
      };
    }
    return this.requestJson('GET', interPixPathCobv(txid), credencialRef, contaCorrente);
  }

  simularPagamentoCobvMock(
    txid: string,
    opcoes: { valor: number; juros?: number; multa?: number; desconto?: number },
  ): void {
    const mock = this.mockStore.get(txid);
    if (!mock) throw new Error('Cobv mock não encontrada');
    const juros = opcoes.juros ?? 0;
    const multa = opcoes.multa ?? 0;
    const desconto = opcoes.desconto ?? 0;
    const valor = opcoes.valor;
    const principal = Math.round((valor - juros - multa + desconto) * 100) / 100;
    const e2e = `E2E-MOCK-${txid.slice(-12)}`;
    mock.pixRecebidos.push({
      endToEndId: e2e,
      valor,
      horario: new Date().toISOString().slice(0, 10),
      valorPrincipal: principal,
      juros,
      multa,
      desconto,
    });
    mock.status = 'CONCLUIDA';
  }

  /** Sandbox: força vencimento expirado no mock (validadeApós = 0 e data passada). */
  expirarCobvMock(txid: string): void {
    const mock = this.mockStore.get(txid);
    if (!mock) throw new Error('Cobv mock não encontrada');
    mock.dataDeVencimento = '2020-01-01';
    mock.validadeAposVencimento = 0;
    mock.status = 'ATIVA';
    mock.pixRecebidos = [];
  }

  listarCobvMockEmAberto(): string[] {
    return [...this.mockStore.entries()]
      .filter(([, v]) => v.status !== 'CONCLUIDA')
      .map(([k]) => k);
  }

  async cadastrarWebhookPix(
    credencialRef: string,
    contaCorrente: string | null,
    chavePix: string,
    webhookUrl: string,
  ): Promise<Record<string, unknown>> {
    if (this.mockMode()) {
      return { webhookUrl, chave: chavePix, mock: true };
    }
    return this.requestJson(
      'PUT',
      interPixPathWebhook(chavePix),
      credencialRef,
      contaCorrente,
      { webhookUrl },
    );
  }

  private requestJson(
    method: string,
    path: string,
    credencialRef: string,
    contaCorrente: string | null,
    jsonBody?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.token(credencialRef).then(({ token, material }) => {
      const url = new URL(`${this.apiRoot()}${path}`);
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
                this.logger.warn(`Inter Pix ${res.statusCode}: ${mascararParaLog(raw.slice(0, 400))}`);
                reject(new Error(`Inter Pix HTTP ${res.statusCode}`));
                return;
              }
              try {
                resolve(JSON.parse(raw || '{}') as Record<string, unknown>);
              } catch {
                reject(new Error('Resposta Pix inválida'));
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