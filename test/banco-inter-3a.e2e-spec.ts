import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  authHeaders,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SENHA,
  login,
} from './e2e-auth.helpers';

describe('Fase 3A — InterProvider e sincronização (e2e, mock)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let empresaId: string;
  let contaId: string;

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

    const criar = await request(app.getHttpServer())
      .post('/v1/contas-bancarias')
      .set(authHeaders(token, empresaId))
      .send({
        apelido: 'Inter E2E mock',
        banco_codigo: '077',
        agencia: '0001',
        conta: '99901',
        provedor: 'INTER',
        credencial_ref: 'e2e',
        sincroniza_extrato: true,
      });
    expect(criar.status).toBe(201);
    contaId = criar.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('consulta saldo via provider (mock) e persiste saldo_banco', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/contas-bancarias/${contaId}/saldo`)
      .set(authHeaders(token, empresaId));
    expect(res.status).toBe(200);
    expect(res.body.saldo_banco).toBeCloseTo(12345.67, 2);
    expect(res.body.provedor).toBe('INTER');

    const [conta] = await dataSource.query(
      `SELECT saldo_banco::float, saldo_banco_em IS NOT NULL AS tem_data FROM contas_bancarias WHERE id = $1`,
      [contaId],
    );
    expect(conta.saldo_banco).toBeCloseTo(12345.67, 2);
    expect(conta.tem_data).toBe(true);
  });

  it('sincroniza extrato com deduplicação por id_externo', async () => {
    const sync1 = await request(app.getHttpServer())
      .post(`/v1/contas-bancarias/${contaId}/sincronizar`)
      .query({ de: '2026-11-01', ate: '2026-11-30' })
      .set(authHeaders(token, empresaId));
    expect(sync1.status).toBe(201);
    expect(sync1.body.inseridos).toBe(2);
    expect(sync1.body.ignorados).toBe(0);

    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM movimentos_bancarios WHERE conta_bancaria_id = $1`,
      [contaId],
    );
    expect(count).toBe(2);

    const sync2 = await request(app.getHttpServer())
      .post(`/v1/contas-bancarias/${contaId}/sincronizar`)
      .query({ de: '2026-11-01', ate: '2026-11-30' })
      .set(authHeaders(token, empresaId));
    expect(sync2.body.inseridos).toBe(0);
    expect(sync2.body.ignorados).toBe(2);

    const ids = await dataSource.query(
      `SELECT id_externo FROM movimentos_bancarios WHERE conta_bancaria_id = $1 ORDER BY id_externo`,
      [contaId],
    );
    expect(ids.map((r: { id_externo: string }) => r.id_externo)).toEqual([
      'inter-e2e-tx-001',
      'inter-e2e-tx-002',
    ]);
  });

  it('GET extrato expõe linhas do período', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/contas-bancarias/${contaId}/extrato`)
      .query({ de: '2026-11-01', ate: '2026-11-30' })
      .set(authHeaders(token, empresaId));
    expect(res.status).toBe(200);
    expect(res.body.linhas.length).toBeGreaterThanOrEqual(2);
  });

  it('rejeita conta Inter sem credencial_ref', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/contas-bancarias')
      .set(authHeaders(token, empresaId))
      .send({
        apelido: 'Inter sem cred',
        banco_codigo: '077',
        provedor: 'INTER',
      });
    expect(res.status).toBe(400);
  });
});