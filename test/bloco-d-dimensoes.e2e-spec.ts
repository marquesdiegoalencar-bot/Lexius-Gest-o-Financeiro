import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  authHeaders,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SENHA,
  login,
} from './e2e-auth.helpers';

describe('Bloco D — dimensões em títulos e recorrências (e2e)', () => {
  let app: INestApplication;
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
    ({ token, empresaId } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria título a receber com departamento e centro e filtra por departamento', async () => {
    const deptRes = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(token, empresaId))
      .send({ nome: 'Dept D e2e' });
    expect(deptRes.status).toBe(201);
    const deptId = deptRes.body.id;

    const ccRes = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(token, empresaId))
      .send({ nome: 'CC D e2e', tipo: 'ENTRADA', tipo_no: 'ANALITICO' });
    expect(ccRes.status).toBe(201);
    const ccId = ccRes.body.id;

    const catRes = await request(app.getHttpServer())
      .get('/v1/categorias?natureza=RECEITA')
      .set(authHeaders(token, empresaId));
    const categoriaId = catRes.body[0].id;

    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TR dims',
        valor_original: 100,
        data_vencimento: '2031-06-01',
        categoria_id: categoriaId,
        departamento_id: deptId,
        centro_custo_id: ccId,
      });
    expect(criar.status).toBe(201);
    expect(criar.body.departamentoId).toBe(deptId);
    expect(criar.body.centroCustoId).toBe(ccId);

    const lista = await request(app.getHttpServer())
      .get(`/v1/titulos-receber?departamento_id=${deptId}`)
      .set(authHeaders(token, empresaId));
    expect(lista.status).toBe(200);
    expect(lista.body.some((t: { id: string }) => t.id === criar.body.id)).toBe(true);
  });

  it('recorrência propaga dimensões ao gerar título', async () => {
    const deptRes = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(token, empresaId))
      .send({ nome: 'Dept rec' });
    const ccRes = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(token, empresaId))
      .send({ nome: 'CC rec', tipo: 'SAIDA', tipo_no: 'ANALITICO' });
    const catRes = await request(app.getHttpServer())
      .get('/v1/categorias?natureza=DESPESA')
      .set(authHeaders(token, empresaId));

    const rec = await request(app.getHttpServer())
      .post('/v1/recorrencias')
      .set(authHeaders(token, empresaId))
      .send({
        natureza: 'DESPESA',
        descricao: 'Rec dims',
        categoria_id: catRes.body[0].id,
        valor: 50,
        frequencia: 'MENSAL',
        inicio: '2030-01-01',
        gerar_antecedencia_dias: 3650,
        departamento_id: deptRes.body.id,
        centro_custo_id: ccRes.body.id,
      });
    expect(rec.status).toBe(201);

    const gerar = await request(app.getHttpServer())
      .post(`/v1/recorrencias/${rec.body.id}/gerar`)
      .set(authHeaders(token, empresaId))
      .send({});
    expect(gerar.status).toBe(201);
    const titulo = gerar.body.titulos?.[0];
    expect(titulo.departamentoId).toBe(deptRes.body.id);
    expect(titulo.centroCustoId).toBe(ccRes.body.id);

    const dup = await request(app.getHttpServer())
      .post(`/v1/recorrencias/${rec.body.id}/gerar`)
      .set(authHeaders(token, empresaId))
      .send({});
    expect(dup.body.duplicado).toBe(true);
  });
});