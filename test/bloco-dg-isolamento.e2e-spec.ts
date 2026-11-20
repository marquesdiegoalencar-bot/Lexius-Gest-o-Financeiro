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
import { cnpjE2e } from './e2e-cnpj.helpers';

const CNPJ_EMPRESA_B = cnpjE2e('bloco-dg-isolamento.empresa-b');

describe('Bloco D–G — isolamento multiempresa (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let empresaA: string;
  let empresaB: string;
  let categoriaId: string;

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

    ({ token, empresaId: empresaA } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
    categoriaId = await getCategoriaGlobal(dataSource, '1.01');

    const [masterUser] = await dataSource.query(`SELECT id FROM usuarios WHERE email = $1`, [
      E2E_MASTER_EMAIL,
    ]);
    const [outra] = await dataSource.query(
      `INSERT INTO empresas (tipo, razao_social, cnpj)
       VALUES ('OUTRA', 'E2E Isolamento DG', $1)
       RETURNING id`,
      [CNPJ_EMPRESA_B],
    );
    empresaB = outra.id;
    await dataSource.query(
      `INSERT INTO usuario_empresa (usuario_id, empresa_id, papel) VALUES ($1, $2, 'MASTER')
       ON CONFLICT DO NOTHING`,
      [masterUser.id, empresaB],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('rateio: definição e histórico de outra empresa retornam 404', async () => {
    const tr = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaA))
      .send({
        descricao: 'Isol rateio',
        categoria_id: categoriaId,
        valor_original: 40,
        data_vencimento: '2033-01-01',
      });
    const tituloId = tr.body.id;
    const rasc = await request(app.getHttpServer())
      .post(`/v1/rateio/titulos-receber/${tituloId}/rascunho`)
      .set(authHeaders(token, empresaA))
      .send({ modo: 'PERCENTUAL' });

    const crossGet = await request(app.getHttpServer())
      .get(`/v1/rateio/definicoes/${rasc.body.definicao.id}`)
      .set(authHeaders(token, empresaB));
    expect(crossGet.status).toBe(404);

    const crossHist = await request(app.getHttpServer())
      .get(`/v1/rateio/titulos-receber/${tituloId}/historico`)
      .set(authHeaders(token, empresaB));
    expect(crossHist.status).toBe(200);
    expect(crossHist.body.length).toBe(0);
  });

  it('DRE: empresa B não enxerga títulos da empresa A', async () => {
    await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaA))
      .send({
        descricao: 'Isol DRE A',
        categoria_id: categoriaId,
        valor_original: 999,
        data_vencimento: '2033-02-01',
        data_competencia: '2033-02-10',
      });

    const dreB = await request(app.getHttpServer())
      .get('/v1/dre/competencia?de=2033-02-01&ate=2033-02-28&natureza=RECEITA')
      .set(authHeaders(token, empresaB));
    expect(dreB.status).toBe(200);
    expect(dreB.body.totais.receitas).toBe(0);
  });

  it('orçamento: versão de A inacessível com X-Empresa-Id B', async () => {
    const versao = await request(app.getHttpServer())
      .post('/v1/orcamento/versoes')
      .set(authHeaders(token, empresaA))
      .send({ ano: 2033, mes: 5, nome: 'Isol' });
    expect(versao.status).toBe(201);

    const cross = await request(app.getHttpServer())
      .get(`/v1/orcamento/versoes/${versao.body.id}`)
      .set(authHeaders(token, empresaB));
    expect(cross.status).toBe(404);
  });
});