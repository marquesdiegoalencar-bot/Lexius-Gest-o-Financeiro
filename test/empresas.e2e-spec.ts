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
import { cnpjE2e } from './e2e-cnpj.helpers';

describe('empresas (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let masterToken: string;
  let masterEmpresaId: string;

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

    ({ token: masterToken, empresaId: masterEmpresaId } = await login(
      app,
      E2E_MASTER_EMAIL,
      E2E_MASTER_SENHA,
    ));
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria, atualiza e exclui empresa sem lançamentos', async () => {
    const cnpj = cnpjE2e('empresas.crud-livre');
    const create = await request(app.getHttpServer())
      .post('/v1/empresas')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({
        razao_social: 'E2E Empresa CRUD',
        nome_fantasia: 'E2E Fantasia',
        cnpj,
        tipo: 'OUTRA',
        fuso_negocio: 'America/Sao_Paulo',
      });
    expect(create.status).toBe(201);
    const id = create.body.id as string;
    expect(create.body.fusoNegocio).toBe('America/Sao_Paulo');

    const patch = await request(app.getHttpServer())
      .patch(`/v1/empresas/${id}`)
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ razao_social: 'E2E Empresa Atualizada', ativa: true });
    expect(patch.status).toBe(200);
    expect(patch.body.razaoSocial).toBe('E2E Empresa Atualizada');

    const del = await request(app.getHttpServer())
      .delete(`/v1/empresas/${id}`)
      .set(authHeaders(masterToken, masterEmpresaId));
    expect(del.status).toBe(200);

    const get = await request(app.getHttpServer())
      .get(`/v1/empresas/${id}`)
      .set(authHeaders(masterToken, masterEmpresaId));
    expect(get.status).toBe(404);
  });

  it('bloqueia exclusão quando há departamentos vinculados', async () => {
    const cnpj = cnpjE2e('empresas.com-dep');
    const create = await request(app.getHttpServer())
      .post('/v1/empresas')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({
        razao_social: 'E2E Com Dep',
        cnpj,
        tipo: 'OUTRA',
      });
    expect(create.status).toBe(201);
    const id = create.body.id as string;

    await dataSource.query(
      `INSERT INTO departamentos (empresa_id, nome, ativo) VALUES ($1, 'Teste', true)`,
      [id],
    );

    const del = await request(app.getHttpServer())
      .delete(`/v1/empresas/${id}`)
      .set(authHeaders(masterToken, masterEmpresaId));
    expect(del.status).toBe(409);

    await dataSource.query(`DELETE FROM departamentos WHERE empresa_id = $1`, [id]);
    const del2 = await request(app.getHttpServer())
      .delete(`/v1/empresas/${id}`)
      .set(authHeaders(masterToken, masterEmpresaId));
    expect(del2.status).toBe(200);
  });
});