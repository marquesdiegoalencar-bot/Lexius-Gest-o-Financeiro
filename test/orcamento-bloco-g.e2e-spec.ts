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

describe('orçamento Bloco G (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let empresaId: string;
  let categoriaFolhaId: string;

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
    categoriaFolhaId = await getCategoriaGlobal(dataSource, '1.01');
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria versão, salva item folha e retorna realizado vs previsto', async () => {
    const versao = await request(app.getHttpServer())
      .post('/v1/orcamento/versoes')
      .set(authHeaders(token, empresaId))
      .send({ ano: 2026, mes: 12, nome: 'E2E' });
    expect(versao.status).toBe(201);
    const versaoId = versao.body.id;

    const itens = await request(app.getHttpServer())
      .post(`/v1/orcamento/versoes/${versaoId}/itens`)
      .set(authHeaders(token, empresaId))
      .send({
        itens: [{ categoria_id: categoriaFolhaId, valor_previsto: 1000 }],
      });
    expect(itens.status).toBe(201);

    const comp = await request(app.getHttpServer())
      .get(`/v1/orcamento/versoes/${versaoId}/realizado-vs-previsto`)
      .set(authHeaders(token, empresaId));
    expect(comp.status).toBe(200);
    expect(comp.body.totais.previsto).toBe(1000);
    expect(comp.body.linhas.length).toBe(1);
    expect(comp.body.periodo.de).toBe('2026-12-01');
  });

  it('aprova, bloqueia edição, fecha e cancela rascunho', async () => {
    const v1 = await request(app.getHttpServer())
      .post('/v1/orcamento/versoes')
      .set(authHeaders(token, empresaId))
      .send({ ano: 2027, mes: 1, nome: 'Fluxo' });
    const versaoId = v1.body.id;

    await request(app.getHttpServer())
      .post(`/v1/orcamento/versoes/${versaoId}/itens`)
      .set(authHeaders(token, empresaId))
      .send({ itens: [{ categoria_id: categoriaFolhaId, valor_previsto: 500 }] });

    const aprovar = await request(app.getHttpServer())
      .patch(`/v1/orcamento/versoes/${versaoId}/aprovar`)
      .set(authHeaders(token, empresaId));
    expect(aprovar.status).toBe(200);
    expect(aprovar.body.status).toBe('APROVADO');

    const edit = await request(app.getHttpServer())
      .post(`/v1/orcamento/versoes/${versaoId}/itens`)
      .set(authHeaders(token, empresaId))
      .send({ itens: [{ categoria_id: categoriaFolhaId, valor_previsto: 999 }] });
    expect(edit.status).toBe(409);

    const fechar = await request(app.getHttpServer())
      .patch(`/v1/orcamento/versoes/${versaoId}/fechar`)
      .set(authHeaders(token, empresaId));
    expect(fechar.status).toBe(200);
    expect(fechar.body.status).toBe('FECHADO');

    const rasc = await request(app.getHttpServer())
      .post('/v1/orcamento/versoes')
      .set(authHeaders(token, empresaId))
      .send({ ano: 2027, mes: 2, nome: 'Cancel' });
    const cancel = await request(app.getHttpServer())
      .patch(`/v1/orcamento/versoes/${rasc.body.id}/cancelar`)
      .set(authHeaders(token, empresaId));
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('CANCELADO');
  });

  it('substituição: nova aprovação no mesmo período marca anterior SUPERSEDED', async () => {
    const mk = (nome: string) =>
      request(app.getHttpServer())
        .post('/v1/orcamento/versoes')
        .set(authHeaders(token, empresaId))
        .send({ ano: 2027, mes: 6, nome });

    const v1 = await mk('V1');
    await request(app.getHttpServer())
      .post(`/v1/orcamento/versoes/${v1.body.id}/itens`)
      .set(authHeaders(token, empresaId))
      .send({ itens: [{ categoria_id: categoriaFolhaId, valor_previsto: 100 }] });
    await request(app.getHttpServer())
      .patch(`/v1/orcamento/versoes/${v1.body.id}/aprovar`)
      .set(authHeaders(token, empresaId));

    const v2 = await mk('V2');
    await request(app.getHttpServer())
      .post(`/v1/orcamento/versoes/${v2.body.id}/itens`)
      .set(authHeaders(token, empresaId))
      .send({ itens: [{ categoria_id: categoriaFolhaId, valor_previsto: 200 }] });
    await request(app.getHttpServer())
      .patch(`/v1/orcamento/versoes/${v2.body.id}/aprovar`)
      .set(authHeaders(token, empresaId));

    const lista = await request(app.getHttpServer())
      .get('/v1/orcamento/versoes?ano=2027&mes=6')
      .set(authHeaders(token, empresaId));
    const statuses = lista.body.map((v: { status: string }) => v.status);
    expect(statuses.filter((s: string) => s === 'APROVADO').length).toBe(1);
    expect(statuses).toContain('SUPERSEDED');

    const obterV1 = await request(app.getHttpServer())
      .get(`/v1/orcamento/versoes/${v1.body.id}`)
      .set(authHeaders(token, empresaId));
    expect(obterV1.body.versao.status).toBe('SUPERSEDED');
  });
});