import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  authHeaders,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SENHA,
  E2E_OPERADOR_EMAIL,
  E2E_OPERADOR_SENHA,
  login,
} from './e2e-auth.helpers';

describe('centros-custo (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let masterToken: string;
  let masterEmpresaId: string;
  let operadorToken: string;
  let operadorEmpresaId: string;

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

    const migCols = await dataSource.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'centros_custo'
       AND column_name IN ('codigo', 'descricao', 'tipo', 'pai_id', 'tipo_no')`,
    );
    expect(migCols.length).toBe(5);

    ({ token: masterToken, empresaId: masterEmpresaId } = await login(
      app,
      E2E_MASTER_EMAIL,
      E2E_MASTER_SENHA,
    ));
    ({ token: operadorToken, empresaId: operadorEmpresaId } = await login(
      app,
      E2E_OPERADOR_EMAIL,
      E2E_OPERADOR_SENHA,
    ));
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejeita listagem sem token (JWT) com 401', async () => {
    const res = await request(app.getHttpServer()).get('/v1/centros-custo');
    expect(res.status).toBe(401);
  });

  it('rejeita token inválido com 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/centros-custo')
      .set(authHeaders('token-invalido', masterEmpresaId));
    expect(res.status).toBe(401);
  });

  it('rejeita requisição sem X-Empresa-Id com 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/centros-custo')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(403);
    expect(String(res.body.message)).toMatch(/X-Empresa-Id/i);
  });

  it('MASTER: cria, edita e lista centro de custo entrada', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({
        codigo: 'CC-E2E-1',
        nome: 'Centro entrada',
        descricao: 'Descrição teste',
        tipo: 'ENTRADA',
      });
    expect(criar.status).toBe(201);
    expect(criar.body.nome).toBe('Centro entrada');

    const editar = await request(app.getHttpServer())
      .patch(`/v1/centros-custo/${criar.body.id}`)
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ descricao: 'Descrição atualizada' });
    expect(editar.status).toBe(200);
    expect(editar.body.descricao).toBe('Descrição atualizada');

    const lista = await request(app.getHttpServer())
      .get('/v1/centros-custo?tipo=ENTRADA')
      .set(authHeaders(masterToken, masterEmpresaId));
    expect(lista.status).toBe(200);
    expect(lista.body.some((c: { id: string }) => c.id === criar.body.id)).toBe(true);
  });

  it('OPERADOR: pode criar centro de custo', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(operadorToken, operadorEmpresaId))
      .send({ nome: 'CC Operador', tipo: 'SAIDA' });
    expect(res.status).toBe(201);
  });

  it('CONSULTA: pode listar mas não criar (403)', async () => {
    const consultaEmail = 'consulta.e2e@lexius.local';
    const [masterRow] = await dataSource.query(`SELECT senha_hash FROM usuarios WHERE email = $1`, [
      E2E_MASTER_EMAIL,
    ]);
    await dataSource.query(
      `INSERT INTO usuarios (nome, email, senha_hash, ativo)
       VALUES ('Consulta E2E', $1, $2, true)
       ON CONFLICT (email) DO UPDATE SET ativo = true`,
      [consultaEmail, masterRow.senha_hash],
    );
    const [consultaUser] = await dataSource.query(`SELECT id FROM usuarios WHERE email = $1`, [consultaEmail]);
    await dataSource.query(
      `INSERT INTO usuario_empresa (usuario_id, empresa_id, papel)
       VALUES ($1, $2, 'CONSULTA')
       ON CONFLICT (usuario_id, empresa_id) DO UPDATE SET papel = 'CONSULTA'`,
      [consultaUser.id, masterEmpresaId],
    );

    const auth = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: consultaEmail, senha: E2E_MASTER_SENHA });
    expect(auth.status).toBe(201);
    const consultaToken = auth.body.access_token as string;

    const lista = await request(app.getHttpServer())
      .get('/v1/centros-custo')
      .set(authHeaders(consultaToken, masterEmpresaId));
    expect(lista.status).toBe(200);

    const criar = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(consultaToken, masterEmpresaId))
      .send({ nome: 'Bloqueado consulta', tipo: 'ENTRADA' });
    expect(criar.status).toBe(403);
  });

  it('hierarquia válida: GRUPO → SUBGRUPO → ANALITICO (3 níveis)', async () => {
    const grupo = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ nome: 'Grupo E2E', tipo: 'ENTRADA', tipo_no: 'GRUPO' });
    expect(grupo.status).toBe(201);

    const sub = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ nome: 'Subgrupo E2E', tipo: 'ENTRADA', tipo_no: 'SUBGRUPO', pai_id: grupo.body.id });
    expect(sub.status).toBe(201);

    const analitico = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ nome: 'Analítico E2E', tipo: 'ENTRADA', tipo_no: 'ANALITICO', pai_id: sub.body.id });
    expect(analitico.status).toBe(201);

    const arvore = await request(app.getHttpServer())
      .get('/v1/centros-custo/arvore?tipo=ENTRADA')
      .set(authHeaders(masterToken, masterEmpresaId));
    expect(arvore.status).toBe(200);
    const raiz = arvore.body.find((n: { id: string }) => n.id === grupo.body.id);
    expect(raiz?.filhos?.[0]?.id).toBe(sub.body.id);
  });

  it('rejeita SUBGRUPO raiz, profundidade > 3 e SUBGRUPO sob SUBGRUPO', async () => {
    const subRaiz = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ nome: 'Sub raiz', tipo: 'ENTRADA', tipo_no: 'SUBGRUPO' });
    expect(subRaiz.status).toBe(400);

    const g = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ nome: 'G prof', tipo: 'ENTRADA', tipo_no: 'GRUPO' });
    const s = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ nome: 'S prof', tipo: 'ENTRADA', tipo_no: 'SUBGRUPO', pai_id: g.body.id });
    const a = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ nome: 'A prof', tipo: 'ENTRADA', tipo_no: 'ANALITICO', pai_id: s.body.id });
    expect(a.status).toBe(201);

    const quarto = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({
        nome: 'Abaixo analítico',
        tipo: 'ENTRADA',
        tipo_no: 'ANALITICO',
        pai_id: a.body.id,
      });
    expect(quarto.status).toBe(400);

    const g2 = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ nome: 'G2', tipo: 'ENTRADA', tipo_no: 'GRUPO' });
    const s1 = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ nome: 'S1', tipo: 'ENTRADA', tipo_no: 'SUBGRUPO', pai_id: g2.body.id });
    const s2 = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ nome: 'S2', tipo: 'ENTRADA', tipo_no: 'SUBGRUPO', pai_id: s1.body.id });
    expect(s2.status).toBe(400);
  });

  it('inativação: grupo com filho ativo bloqueia; analítico com título em aberto permite', async () => {
    const grupo = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ nome: 'Grupo inat', tipo: 'ENTRADA', tipo_no: 'GRUPO' });
    const filho = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({
        nome: 'Filho ativo',
        tipo: 'ENTRADA',
        tipo_no: 'ANALITICO',
        pai_id: grupo.body.id,
      });
    const bloqueio = await request(app.getHttpServer())
      .patch(`/v1/centros-custo/${grupo.body.id}`)
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ ativo: false });
    expect(bloqueio.status).toBe(400);

    const analitico = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ nome: 'CC título', tipo: 'ENTRADA', tipo_no: 'ANALITICO' });
    const [cat] = await dataSource.query(`SELECT id FROM categorias WHERE codigo = '1.01' AND empresa_id IS NULL`);
    const titulo = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({
        descricao: 'Com CC',
        categoria_id: cat.id,
        centro_custo_id: analitico.body.id,
        valor_original: 100,
        data_vencimento: '2026-12-31',
      });
    expect(titulo.status).toBe(201);

    const inativar = await request(app.getHttpServer())
      .patch(`/v1/centros-custo/${analitico.body.id}`)
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ ativo: false });
    expect(inativar.status).toBe(200);

    const novoVinculo = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({
        descricao: 'CC inativo',
        categoria_id: cat.id,
        centro_custo_id: analitico.body.id,
        valor_original: 50,
        data_vencimento: '2026-12-31',
      });
    expect(novoVinculo.status).toBe(400);

    const grupoVinculo = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({
        descricao: 'CC grupo',
        categoria_id: cat.id,
        centro_custo_id: grupo.body.id,
        valor_original: 50,
        data_vencimento: '2026-12-31',
      });
    expect(grupoVinculo.status).toBe(400);
  });

  it('reativação exige pai ativo', async () => {
    const grupo = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ nome: 'Pai reativ', tipo: 'ENTRADA', tipo_no: 'GRUPO' });
    const filho = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ nome: 'Filho reativ', tipo: 'ENTRADA', tipo_no: 'ANALITICO', pai_id: grupo.body.id });

    await request(app.getHttpServer())
      .patch(`/v1/centros-custo/${filho.body.id}`)
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ ativo: false });
    await request(app.getHttpServer())
      .patch(`/v1/centros-custo/${grupo.body.id}`)
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ ativo: false });

    const reativarFilho = await request(app.getHttpServer())
      .patch(`/v1/centros-custo/${filho.body.id}`)
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ ativo: true });
    expect(reativarFilho.status).toBe(400);

    await request(app.getHttpServer())
      .patch(`/v1/centros-custo/${grupo.body.id}`)
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ ativo: true });
    const reativarOk = await request(app.getHttpServer())
      .patch(`/v1/centros-custo/${filho.body.id}`)
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ ativo: true });
    expect(reativarOk.status).toBe(200);
  });

  it('isolamento: centro criado não aparece com X-Empresa-Id de outra empresa', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ codigo: 'ISO-1', nome: 'Isolamento teste', tipo: 'ENTRADA' });
    expect(criar.status).toBe(201);

    const fakeEmpresaId = '00000000-0000-4000-8000-000000000099';
    const lista = await request(app.getHttpServer())
      .get('/v1/centros-custo')
      .set(authHeaders(masterToken, fakeEmpresaId));
    expect(lista.status).toBe(403);
  });
});