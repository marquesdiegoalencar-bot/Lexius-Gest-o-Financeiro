import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as http from 'http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { CobRetornoService } from '../src/modules/integracao-cobranca-retorno/cob-retorno.service';
import {
  authHeaders,
  criarContaBancaria,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SENHA,
  login,
} from './e2e-auth.helpers';
import {
  buildAcordoExemploSpec,
  E2E_COB_API_KEY,
  E2E_HMAC_SECRET,
  signCobBody,
  verifyCobRetornoBody,
} from './cob-integracao.helpers';

type MockRequest = {
  rawBody: string;
  tipo: string;
  eventoId: string;
  timestamp: string;
  signature: string;
};

function aguardar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

describe('Fase 3C — retorno COB (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let retorno: CobRetornoService;
  let token: string;
  let empresaId: string;
  let contaId: string;
  let mockUrl: string;
  let recebidos: MockRequest[] = [];
  let falhasRestantes = 0;
  let server: http.Server;

  const codigo = `ACE_3C_${Date.now()}`;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        const signature = String(req.headers['x-signature'] ?? '');
        const timestamp = String(req.headers['x-timestamp'] ?? '');
        const apiKey = String(req.headers['x-api-key'] ?? '');

        if (apiKey !== E2E_COB_API_KEY) {
          res.writeHead(401);
          res.end();
          return;
        }
        if (!verifyCobRetornoBody(rawBody, signature, timestamp)) {
          res.writeHead(401);
          res.end();
          return;
        }

        const parsed = JSON.parse(rawBody) as { tipo: string; evento_id: string };
        if (falhasRestantes > 0) {
          falhasRestantes -= 1;
          res.writeHead(500);
          res.end('erro simulado');
          return;
        }

        recebidos.push({
          rawBody,
          tipo: parsed.tipo,
          eventoId: parsed.evento_id,
          timestamp,
          signature,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('mock bind');
    mockUrl = `http://127.0.0.1:${addr.port}/webhook`;

    process.env.COB_RETORNO_URL = mockUrl;
    process.env.COB_RETORNO_MAX_TENTATIVAS = '5';

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    retorno = moduleFixture.get(CobRetornoService);
    ({ token, empresaId } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
    contaId = await criarContaBancaria(app, token, empresaId);

    const body = JSON.stringify(buildAcordoExemploSpec(codigo));
    const resAcordo = await request(app.getHttpServer())
      .post('/v1/integracao/cobranca/acordos')
      .set('Content-Type', 'application/json')
      .set('X-Api-Key', E2E_COB_API_KEY)
      .set('X-Signature', signCobBody(body))
      .send(body);
    expect(resAcordo.status).toBe(201);
  });

  afterAll(async () => {
    await app?.close();
    await new Promise<void>((r) => server.close(() => r()));
  });

  async function titulosAcordo() {
    const rows = await dataSource.query(
      `SELECT tr.id, tr.cobranca_parcela_id, tr.parcela_numero, tr.valor_original
       FROM titulos_receber tr
       JOIN cobranca_acordos ca ON ca.id = tr.acordo_id
       WHERE ca.codigo = $1
       ORDER BY tr.parcela_numero`,
      [codigo],
    );
    return rows as Array<{
      id: string;
      cobranca_parcela_id: string;
      parcela_numero: number;
      valor_original: string;
    }>;
  }

  async function baixarTitulo(tituloId: string, valor: number) {
    const res = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${tituloId}/baixar`)
      .set(authHeaders(token, empresaId))
      .send({
        conta_bancaria_id: contaId,
        data_baixa: '2026-11-15',
        valor_principal: valor,
        forma: 'PIX',
      });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function aguardarEnvios(minimo: number, timeoutMs = 8000) {
    const inicio = Date.now();
    while (Date.now() - inicio < timeoutMs) {
      await retorno.processarPendentes();
      if (recebidos.length >= minimo) return;
      await aguardar(50);
    }
    throw new Error(`Timeout: esperava ${minimo} envios, recebeu ${recebidos.length}`);
  }

  it('baixa enfileira titulo.baixado e acordo.atualizado com HMAC v2', async () => {
    const titulos = await titulosAcordo();
    const entrada = titulos.find((t) => t.parcela_numero === 0)!;
    recebidos.length = 0;
    await baixarTitulo(entrada.id, Number(entrada.valor_original));
    await aguardarEnvios(2);

    expect(recebidos[0].tipo).toBe('titulo.baixado');
    expect(recebidos[1].tipo).toBe('acordo.atualizado');
    expect(recebidos[0].timestamp).toMatch(/^\d+$/);
    expect(verifyCobRetornoBody(recebidos[0].rawBody, recebidos[0].signature, recebidos[0].timestamp)).toBe(
      true,
    );

    const idsEvento = recebidos.map((r) => r.eventoId);
    expect(new Set(idsEvento).size).toBe(idsEvento.length);
  });

  it('ordena envios por acordo (titulo antes de acordo.atualizado)', async () => {
    const titulos = await titulosAcordo();
    const p1 = titulos.find((t) => t.parcela_numero === 1)!;
    recebidos.length = 0;
    await baixarTitulo(p1.id, Number(p1.valor_original));
    await aguardarEnvios(2);
    const tipos = recebidos.map((r) => r.tipo);
    expect(tipos).toEqual(['titulo.baixado', 'acordo.atualizado']);
  });

  it('retentativa após falha HTTP e idempotência no mock', async () => {
    const titulos = await titulosAcordo();
    const p2 = titulos.find((t) => t.parcela_numero === 2)!;
    recebidos.length = 0;
    falhasRestantes = 1;
    await baixarTitulo(p2.id, Number(p2.valor_original));
    await aguardarEnvios(2, 12_000);

    const chaves = await dataSource.query(
      `SELECT idempotency_key, status, tentativas FROM cob_retorno_eventos WHERE baixa_id IS NOT NULL ORDER BY criada_em DESC LIMIT 4`,
    );
    expect(
      chaves.every(
        (r: { status: string; tentativas: number }) => r.status === 'ENVIADO' || r.tentativas >= 1,
      ),
    ).toBe(true);

    const duplicados = recebidos.filter(
      (r, i, arr) => arr.findIndex((x) => x.eventoId === r.eventoId) !== i,
    );
    expect(duplicados).toHaveLength(0);
  });

  it('estorno MASTER envia titulo.estornado e acordo.atualizado', async () => {
    const titulos = await titulosAcordo();
    const p2 = titulos.find((t) => t.parcela_numero === 2)!;
    const [{ baixa_id }] = await dataSource.query(
      `SELECT b.id AS baixa_id FROM baixas b WHERE b.titulo_receber_id = $1 AND NOT b.estornada ORDER BY b.criada_em DESC LIMIT 1`,
      [p2.id],
    );
    recebidos.length = 0;
    const est = await request(app.getHttpServer())
      .post(`/v1/baixas/${baixa_id}/estornar`)
      .set(authHeaders(token, empresaId))
      .send({ motivo: 'Teste estorno 3C' });
    expect(est.status).toBe(201);
    await aguardarEnvios(2);

    expect(recebidos.map((r) => r.tipo)).toEqual(['titulo.estornado', 'acordo.atualizado']);
    const corpo = JSON.parse(recebidos[0].rawBody) as { dados: { motivo_estorno: string } };
    expect(corpo.dados.motivo_estorno).toBe('Teste estorno 3C');
  });

  it('evento FALHOU visível para MASTER e reenvio manual', async () => {
    process.env.COB_RETORNO_MAX_TENTATIVAS = '2';
    const titulos = await titulosAcordo();
    const p3 = titulos.find((t) => t.parcela_numero === 3)!;
    recebidos.length = 0;
    falhasRestantes = 99;

    await baixarTitulo(p3.id, Number(p3.valor_original));
    for (let i = 0; i < 5; i++) {
      await retorno.processarPendentes();
      await aguardar(30);
    }

    const falhasApi = await request(app.getHttpServer())
      .get('/v1/integracao/cobranca/retorno/falhas')
      .set(authHeaders(token, empresaId));
    expect(falhasApi.status).toBe(200);
    expect(falhasApi.body.length).toBeGreaterThan(0);

    falhasRestantes = 0;
    const eventoId = falhasApi.body[0].id as string;
    const reenvio = await request(app.getHttpServer())
      .post(`/v1/integracao/cobranca/retorno/eventos/${eventoId}/reenviar`)
      .set(authHeaders(token, empresaId));
    expect(reenvio.status).toBe(201);
    await aguardarEnvios(1, 5000);

    process.env.COB_RETORNO_MAX_TENTATIVAS = '5';
  });
});