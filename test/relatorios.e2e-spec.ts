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

describe('relatorios (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let empresaId: string;

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
    const catRec = await getCategoriaGlobal(dataSource, '1.01');
    const catPag = await getCategoriaGlobal(dataSource, '2.01');
    await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'Rel TR',
        categoria_id: catRec,
        valor_original: 120,
        data_vencimento: '2026-11-01',
      });
    await request(app.getHttpServer())
      .post('/v1/titulos-pagar')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'Rel TP',
        categoria_id: catPag,
        valor_original: 80,
        data_vencimento: '2026-11-05',
      });
  });

  afterAll(async () => {
    await app.close();
  });

  it('retorna relatórios por período e vencidos', async () => {
    const tr = await request(app.getHttpServer())
      .get('/v1/relatorios/titulos-receber')
      .query({ de: '2026-11-01', ate: '2026-11-30' })
      .set(authHeaders(token, empresaId));
    expect(tr.status).toBe(200);
    expect(tr.body.quantidade).toBeGreaterThanOrEqual(1);

    const tp = await request(app.getHttpServer())
      .get('/v1/relatorios/titulos-pagar')
      .query({ de: '2026-11-01', ate: '2026-11-30' })
      .set(authHeaders(token, empresaId));
    expect(tp.status).toBe(200);
    expect(tp.body.quantidade).toBeGreaterThanOrEqual(1);

    const vencidos = await request(app.getHttpServer())
      .get('/v1/relatorios/vencidos')
      .set(authHeaders(token, empresaId));
    expect(vencidos.status).toBe(200);
    expect(vencidos.body).toHaveProperty('titulos_receber');
    expect(vencidos.body).toHaveProperty('titulos_pagar');
  });
});