import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DepartamentosService } from '../src/modules/departamentos/departamentos.service';
import {
  authHeaders,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SENHA,
  E2E_OPERADOR_EMAIL,
  E2E_OPERADOR_SENHA,
  login,
} from './e2e-auth.helpers';

describe('departamentos (e2e) — Bloco C', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let departamentosService: DepartamentosService;
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
    departamentosService = moduleFixture.get(DepartamentosService);

    const mig = await dataSource.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'departamentos'
       ORDER BY ordinal_position`,
    );
    const cols = mig.map((r: { column_name: string }) => r.column_name);
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'empresa_id',
        'codigo',
        'nome',
        'descricao',
        'ativo',
        'criado_em',
        'atualizado_em',
      ]),
    );

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

  it('rejeita listagem sem JWT (401)', async () => {
    const res = await request(app.getHttpServer()).get('/v1/departamentos');
    expect(res.status).toBe(401);
  });

  it('rejeita requisição sem X-Empresa-Id (403)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/departamentos')
      .set('Authorization', `Bearer ${masterToken}`);
    expect(res.status).toBe(403);
  });

  it('cadastra, edita, filtra por empresa e busca textual', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({
        codigo: 'DEP-E2E-1',
        nome: 'Comercial',
        descricao: 'Área comercial',
      });
    expect(criar.status).toBe(201);
    expect(criar.body.ativo).toBe(true);
    expect(criar.body.criadoEm ?? criar.body.criado_em).toBeDefined();

    const editar = await request(app.getHttpServer())
      .patch(`/v1/departamentos/${criar.body.id}`)
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ nome: 'Comercial — atualizado', descricao: 'Nova descrição' });
    expect(editar.status).toBe(200);
    expect(editar.body.nome).toBe('Comercial — atualizado');

    const lista = await request(app.getHttpServer())
      .get('/v1/departamentos?q=Comercial')
      .set(authHeaders(masterToken, masterEmpresaId));
    expect(lista.status).toBe(200);
    expect(lista.body.some((d: { id: string }) => d.id === criar.body.id)).toBe(true);

    const operLista = await request(app.getHttpServer())
      .get('/v1/departamentos?q=Comercial')
      .set(authHeaders(operadorToken, operadorEmpresaId));
    expect(operLista.status).toBe(200);
    if (operadorEmpresaId === masterEmpresaId) {
      expect(operLista.body.some((d: { id: string }) => d.id === criar.body.id)).toBe(true);
    } else {
      expect(operLista.body.some((d: { id: string }) => d.id === criar.body.id)).toBe(false);
    }
  });

  it('valida nome obrigatório e unicidade de código na empresa', async () => {
    const semNome = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ codigo: 'SEM-NOME' });
    expect(semNome.status).toBe(400);

    const nomeVazio = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ codigo: 'NOME-VAZIO', nome: '' });
    expect(nomeVazio.status).toBe(400);

    const soEspacos = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ codigo: 'NOME-ESP', nome: '   ' });
    expect(soEspacos.status).toBe(400);

    const a = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ codigo: 'DUP-1', nome: 'Dept A' });
    expect(a.status).toBe(201);

    const dup = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ codigo: 'DUP-1', nome: 'Dept B' });
    expect(dup.status).toBe(409);

    const [masterUser] = await dataSource.query(`SELECT id FROM usuarios WHERE email = $1`, [
      E2E_MASTER_EMAIL,
    ]);
    const [empOutra] = await dataSource.query(
      `INSERT INTO empresas (tipo, razao_social, nome_fantasia, cnpj)
       VALUES ('OUTRA', 'E2E Dup Empresa', 'Dup Emp', '88888888000188')
       ON CONFLICT DO NOTHING
       RETURNING id`,
    );
    let outraEmpresaId = empOutra?.id as string | undefined;
    if (!outraEmpresaId) {
      const [row] = await dataSource.query(`SELECT id FROM empresas WHERE cnpj = $1`, [
        '88888888000188',
      ]);
      outraEmpresaId = row.id as string;
    }
    expect(outraEmpresaId).toBeDefined();
    await dataSource.query(
      `INSERT INTO usuario_empresa (usuario_id, empresa_id, papel)
       VALUES ($1, $2, 'MASTER') ON CONFLICT (usuario_id, empresa_id) DO NOTHING`,
      [masterUser.id, outraEmpresaId],
    );
    const mesmoCodigoOutraEmpresa = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(masterToken, outraEmpresaId))
      .send({ codigo: 'DUP-1', nome: 'Dept outra empresa' });
    expect(mesmoCodigoOutraEmpresa.status).toBe(201);
  });

  it('duas requisições concorrentes com o mesmo código: uma 201 e outra 409 (índice único)', async () => {
    const codigo = `RACE-${Date.now()}`;
    const [r1, r2] = await Promise.all([
      request(app.getHttpServer())
        .post('/v1/departamentos')
        .set(authHeaders(masterToken, masterEmpresaId))
        .send({ codigo, nome: 'Concorrência A' }),
      request(app.getHttpServer())
        .post('/v1/departamentos')
        .set(authHeaders(masterToken, masterEmpresaId))
        .send({ codigo, nome: 'Concorrência B' }),
    ]);
    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);
    const conflito = r1.status === 409 ? r1 : r2;
    if (conflito.status === 409) {
      expect(String(conflito.body.message)).toMatch(/código/i);
    }
  });

  it('violação real da constraint única (insert SQL) → service devolve 409 via API PATCH', async () => {
    const codigo = `SQL-UNQ-${Date.now()}`;
    await dataSource.query(
      `INSERT INTO departamentos (empresa_id, codigo, nome) VALUES ($1, $2, $3)`,
      [masterEmpresaId, codigo, 'Via SQL'],
    );
    const criar = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ codigo, nome: 'Via API' });
    expect(criar.status).toBe(409);

    const [rowA] = await dataSource.query(
      `SELECT id FROM departamentos WHERE empresa_id = $1 AND codigo = $2 LIMIT 1`,
      [masterEmpresaId, codigo],
    );
    const criarB = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ codigo: `OUTRO-${Date.now()}`, nome: 'Segundo' });
    expect(criarB.status).toBe(201);
    const patch = await request(app.getHttpServer())
      .patch(`/v1/departamentos/${criarB.body.id}`)
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ codigo });
    expect(patch.status).toBe(409);
    expect(String(patch.body.message)).toMatch(/código/i);
    expect(rowA.id).toBeDefined();
  });

  it('inativação preserva registro; reativar; filtro ativo=false', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ codigo: 'INAT-1', nome: 'RH' });
    expect(criar.status).toBe(201);

    const inativar = await request(app.getHttpServer())
      .patch(`/v1/departamentos/${criar.body.id}`)
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ ativo: false });
    expect(inativar.status).toBe(200);
    expect(inativar.body.ativo).toBe(false);

    const aindaExiste = await request(app.getHttpServer())
      .get(`/v1/departamentos/${criar.body.id}`)
      .set(authHeaders(masterToken, masterEmpresaId));
    expect(aindaExiste.status).toBe(200);
    expect(aindaExiste.body.nome).toBe('RH');

    const soInativos = await request(app.getHttpServer())
      .get('/v1/departamentos?ativo=false')
      .set(authHeaders(masterToken, masterEmpresaId));
    expect(soInativos.body.some((d: { id: string }) => d.id === criar.body.id)).toBe(true);

    await request(app.getHttpServer())
      .patch(`/v1/departamentos/${criar.body.id}`)
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ ativo: true });
  });

  it('departamento inativo: assertVinculoFinanceiroFuturo bloqueia (Bloco D)', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ nome: 'Para vínculo futuro' });
    await request(app.getHttpServer())
      .patch(`/v1/departamentos/${criar.body.id}`)
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ ativo: false });

    await expect(
      departamentosService.assertVinculoFinanceiroFuturo(masterEmpresaId, criar.body.id),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('isolamento: não consulta nem altera departamento de outra empresa', async () => {
    const [masterUser] = await dataSource.query(`SELECT id FROM usuarios WHERE email = $1`, [
      E2E_MASTER_EMAIL,
    ]);
    const [outra] = await dataSource.query(
      `INSERT INTO empresas (tipo, razao_social, nome_fantasia, cnpj)
       VALUES ('OUTRA', 'E2E Outra Empresa', 'Outra', '99999999000199')
       RETURNING id`,
    );
    const outraEmpresaId = outra.id as string;
    await dataSource.query(
      `INSERT INTO usuario_empresa (usuario_id, empresa_id, papel)
       VALUES ($1, $2, 'MASTER')
       ON CONFLICT (usuario_id, empresa_id) DO NOTHING`,
      [masterUser.id, outraEmpresaId],
    );

    const criar = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(masterToken, masterEmpresaId))
      .send({ codigo: 'ISO-DEP', nome: 'Isolado' });
    expect(criar.status).toBe(201);

    const getOutra = await request(app.getHttpServer())
      .get(`/v1/departamentos/${criar.body.id}`)
      .set(authHeaders(masterToken, outraEmpresaId));
    expect(getOutra.status).toBe(404);

    const patchOutra = await request(app.getHttpServer())
      .patch(`/v1/departamentos/${criar.body.id}`)
      .set(authHeaders(masterToken, outraEmpresaId))
      .send({ nome: 'Hack' });
    expect(patchOutra.status).toBe(404);

    const fakeEmpresaId = '00000000-0000-4000-8000-000000000099';
    const lista = await request(app.getHttpServer())
      .get('/v1/departamentos')
      .set(authHeaders(masterToken, fakeEmpresaId));
    expect(lista.status).toBe(403);
  });

  it('CONSULTA: listagem permitida, escrita bloqueada (403)', async () => {
    const consultaEmail = 'consulta.dep.e2e@lexius.local';
    const [masterRow] = await dataSource.query(`SELECT senha_hash FROM usuarios WHERE email = $1`, [
      E2E_MASTER_EMAIL,
    ]);
    await dataSource.query(
      `INSERT INTO usuarios (nome, email, senha_hash, ativo)
       VALUES ('Consulta Dep E2E', $1, $2, true)
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
    const consultaToken = auth.body.access_token as string;

    const lista = await request(app.getHttpServer())
      .get('/v1/departamentos')
      .set(authHeaders(consultaToken, masterEmpresaId));
    expect(lista.status).toBe(200);

    const criar = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(consultaToken, masterEmpresaId))
      .send({ nome: 'Bloqueado' });
    expect(criar.status).toBe(403);
  });

  it('centros de custo (Bloco B) permanecem acessíveis após migration 012', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/centros-custo?tipo=ENTRADA')
      .set(authHeaders(masterToken, masterEmpresaId));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});