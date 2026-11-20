import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { FormaPagamento } from '../src/database/enums';
import {
  authHeaders,
  criarContaBancaria,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SENHA,
  getCategoriaGlobal,
  login,
} from './e2e-auth.helpers';

describe('DRE Bloco F (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let empresaId: string;
  let categoriaReceitaId: string;
  let contaId: string;
  let centroId: string;

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
    categoriaReceitaId = await getCategoriaGlobal(dataSource, '1.01');
    contaId = await criarContaBancaria(app, token, empresaId);

    const cc = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(token, empresaId))
      .send({ codigo: 'CC-DRE', nome: 'CC DRE', tipo_no: 'ANALITICO' });
    centroId = cc.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('competência reflete valor do título com alocação legada', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TR DRE competência',
        categoria_id: categoriaReceitaId,
        valor_original: 250,
        data_vencimento: '2026-10-01',
        data_competencia: '2026-10-15',
        centro_custo_id: centroId,
      });
    expect(criar.status).toBe(201);

    const dre = await request(app.getHttpServer())
      .get('/v1/dre/competencia?de=2026-10-01&ate=2026-10-31&natureza=RECEITA')
      .set(authHeaders(token, empresaId));
    expect(dre.status).toBe(200);
    const linha = dre.body.linhas.find(
      (l: { centro_custo_id: string }) => l.centro_custo_id === centroId,
    );
    expect(linha).toBeDefined();
    expect(linha.valor).toBeGreaterThanOrEqual(250);
    expect(dre.body.totais.receitas).toBeGreaterThanOrEqual(250);
  });

  it('caixa agrega baixa alocada', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TR DRE caixa',
        categoria_id: categoriaReceitaId,
        valor_original: 80,
        data_vencimento: '2026-11-01',
        centro_custo_id: centroId,
      });
    const tituloId = criar.body.id;

    await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${tituloId}/baixar`)
      .set(authHeaders(token, empresaId))
      .send({
        conta_bancaria_id: contaId,
        data_baixa: '2026-11-12',
        valor_principal: 80,
        forma: FormaPagamento.PIX,
      });

    const dre = await request(app.getHttpServer())
      .get('/v1/dre/caixa?de=2026-11-01&ate=2026-11-30')
      .set(authHeaders(token, empresaId));
    expect(dre.status).toBe(200);
    expect(dre.body.totais.receitas).toBeGreaterThanOrEqual(80);
  });

  it('competência usa data_emissao como fallback e reporta pendências sem classificação', async () => {
    const trFallback = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TR sem competência com emissão',
        categoria_id: categoriaReceitaId,
        valor_original: 120,
        data_vencimento: '2027-01-15',
      });
    await dataSource.query(
      `UPDATE titulos_receber SET data_competencia = NULL, data_emissao = $2 WHERE id = $1`,
      [trFallback.body.id, '2027-01-10'],
    );

    const dre = await request(app.getHttpServer())
      .get('/v1/dre/competencia?de=2027-01-01&ate=2027-01-31&natureza=RECEITA')
      .set(authHeaders(token, empresaId));
    expect(dre.status).toBe(200);
    expect(dre.body.totais.receitas).toBeGreaterThanOrEqual(120);
    expect(dre.body.avisos?.titulos_sem_classificacao_temporal).toBeDefined();
    expect(typeof dre.body.avisos.titulos_sem_classificacao_temporal.quantidade).toBe('number');
  });

  it('filtra por centro de custo na API', async () => {
    const cc2 = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(token, empresaId))
      .send({ codigo: 'CC-DRE2', nome: 'CC outro', tipo_no: 'ANALITICO' });
    const outroCc = cc2.body.id;

    await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'DRE filtro CC',
        categoria_id: categoriaReceitaId,
        valor_original: 77,
        data_vencimento: '2028-04-01',
        data_competencia: '2028-04-10',
        centro_custo_id: centroId,
      });
    await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'DRE outro CC',
        categoria_id: categoriaReceitaId,
        valor_original: 88,
        data_vencimento: '2028-04-01',
        data_competencia: '2028-04-10',
        centro_custo_id: outroCc,
      });

    const dre = await request(app.getHttpServer())
      .get(
        `/v1/dre/competencia?de=2028-04-01&ate=2028-04-30&centro_custo_id=${centroId}&natureza=RECEITA`,
      )
      .set(authHeaders(token, empresaId));
    expect(dre.status).toBe(200);
    expect(dre.body.linhas.every((l: { centro_custo_id: string }) => l.centro_custo_id === centroId)).toBe(
      true,
    );
    expect(dre.body.totais.receitas).toBeGreaterThanOrEqual(77);
    expect(dre.body.totais.receitas).toBeLessThan(165);
  });
});