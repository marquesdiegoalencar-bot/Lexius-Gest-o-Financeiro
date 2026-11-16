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

describe('intergrupo (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let empresaCobrancaId: string;
  let empresaSistemasId: string;
  let catReceita: string;
  let catDespesa: string;

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
    ({ token, empresaId: empresaCobrancaId } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
    catReceita = await getCategoriaGlobal(dataSource, '1.02');
    catDespesa = await getCategoriaGlobal(dataSource, '2.02');

    const ins = await dataSource.query(
      `INSERT INTO empresas (tipo, razao_social, cnpj)
       VALUES ('SISTEMAS', 'Lexius Sistemas E2E', $1)
       RETURNING id`,
      [`99${Date.now()}`.slice(0, 14)],
    );
    empresaSistemasId = ins[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria operação com título receber e pagar', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/intergrupo')
      .set(authHeaders(token, empresaCobrancaId))
      .send({
        descricao: 'Cobrança interna',
        empresa_credora_id: empresaCobrancaId,
        empresa_devedora_id: empresaSistemasId,
        categoria_receita_id: catReceita,
        categoria_despesa_id: catDespesa,
        valor: 750,
        data_vencimento: '2026-12-20',
      });
    expect(res.status).toBe(201);
    expect(res.body.titulo_receber.origem).toBe('INTERGRUPO');
    expect(res.body.titulo_pagar.origem).toBe('INTERGRUPO');

    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM operacoes_intergrupo WHERE id = $1`,
      [res.body.operacao.id],
    );
    expect(count).toBe(1);
  });
});