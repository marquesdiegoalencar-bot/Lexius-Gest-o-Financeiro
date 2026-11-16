import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  authHeaders,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SENHA,
  getCategoriaGlobal,
  login,
} from './e2e-auth.helpers';

describe('Fase 3B-2 — Pix cobv, webhook e expiração (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let empresaId: string;
  let contaId: string;
  let catReceita: string;

  const webhookHeaders = () => ({
    'X-Inter-Mock-Secret': process.env.WEBHOOK_INTER_MOCK_SECRET ?? 'e2e-webhook-inter-secret',
  });

  beforeAll(async () => {
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
    ({ token, empresaId } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
    catReceita = await getCategoriaGlobal(dataSource, '1.01');

    const contas = await dataSource.query(
      `SELECT id FROM contas_bancarias WHERE empresa_id = $1 AND provedor = 'INTER' LIMIT 1`,
      [empresaId],
    );
    expect(contas.length).toBeGreaterThan(0);
    contaId = contas[0].id;

    await request(app.getHttpServer())
      .post(`/v1/contas-bancarias/${contaId}/tarifas-cobranca`)
      .set(authHeaders(token, empresaId))
      .send({ forma: 'PIX', valor_tarifa: 2 });
  });

  afterAll(async () => {
    await app.close();
  });

  async function criarTitulo(valor: number, pessoaId?: string) {
    let pid = pessoaId;
    if (!pid) {
      const p = await dataSource.query(
        `INSERT INTO pessoas (tipo_pessoa, nome, documento, eh_cliente)
         VALUES ('FISICA', 'Devedor Cobv E2E', '52998224725', true)
         RETURNING id`,
      );
      pid = p[0].id;
    }
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TR cobv 3B2',
        categoria_id: catReceita,
        valor_original: valor,
        data_vencimento: '2026-12-20',
        conta_bancaria_id: contaId,
        pessoa_id: pid,
        forma_prevista: 'PIX',
      });
    return criar.body.id as string;
  }

  it('emite cobv, webhook dispara GET e baixa com valores do array pix', async () => {
    const tituloId = await criarTitulo(120);
    const emitir = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${tituloId}/emitir-pix-cobv`)
      .set(authHeaders(token, empresaId));
    expect(emitir.status).toBe(201);
    const cobrancaId = emitir.body.cobranca.id;
    const txid = emitir.body.txid as string;

    await request(app.getHttpServer())
      .post(`/v1/cobrancas-boleto/${cobrancaId}/simular-pagamento-cobv-mock`)
      .set(authHeaders(token, empresaId))
      .send({ valor: 120 });

    await request(app.getHttpServer())
      .post('/v1/webhooks/inter')
      .set(webhookHeaders())
      .send({ txid });
    await new Promise((r) => setTimeout(r, 500));

    const titulo = await dataSource.query(
      `SELECT status, valor_recebido::float FROM titulos_receber WHERE id = $1`,
      [tituloId],
    );
    expect(titulo[0].status).toBe('PAGO');
    expect(titulo[0].valor_recebido).toBeCloseTo(120, 2);
    expect(txid.length).toBeGreaterThanOrEqual(26);
  });

  it('marca EXPIRADA e permite reemissão com novo txid', async () => {
    const tituloId = await criarTitulo(90);
    const e1 = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${tituloId}/emitir-pix-cobv`)
      .set(authHeaders(token, empresaId));
    const txid1 = e1.body.txid as string;

    const { InterPixCobvHttpService } = await import(
      '../src/modules/banco/inter/inter-pix-cobv-http.service'
    );
    const pixSvc = app.get(InterPixCobvHttpService);
    pixSvc.expirarCobvMock(txid1);

    const poll = await request(app.getHttpServer())
      .post('/v1/webhooks/inter')
      .set(webhookHeaders())
      .send({ txid: txid1 });
    expect(poll.status).toBe(201);
    await new Promise((r) => setTimeout(r, 500));

    const cb = await dataSource.query(`SELECT status FROM cobrancas_boleto WHERE txid = $1`, [txid1]);
    expect(cb[0].status).toBe('EXPIRADA');

    const e2 = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${tituloId}/reemitir-pix-cobv`)
      .set(authHeaders(token, empresaId));
    expect(e2.status).toBe(201);
    expect(e2.body.txid).not.toBe(txid1);
  });

  it('recusa emissão sem documento do devedor', async () => {
    const p = await dataSource.query(
      `INSERT INTO pessoas (tipo_pessoa, nome, documento, eh_cliente)
       VALUES ('FISICA', 'Sem doc', NULL, true) RETURNING id`,
    );
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TR sem doc',
        categoria_id: catReceita,
        valor_original: 10,
        data_vencimento: '2026-12-01',
        conta_bancaria_id: contaId,
        pessoa_id: p[0].id,
      });
    const res = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${criar.body.id}/emitir-pix-cobv`)
      .set(authHeaders(token, empresaId));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/CPF ou CNPJ/i);
  });

  it('simular cobv inexistente fora do mock retorna 404', async () => {
    const prev = process.env.INTER_USE_MOCK;
    process.env.INTER_USE_MOCK = 'false';
    const res = await request(app.getHttpServer())
      .post(`/v1/cobrancas-boleto/00000000-0000-0000-0000-000000000000/simular-pagamento-cobv-mock`)
      .set(authHeaders(token, empresaId))
      .send({ valor: 1 });
    process.env.INTER_USE_MOCK = prev;
    expect(res.status).toBe(404);
  });
});