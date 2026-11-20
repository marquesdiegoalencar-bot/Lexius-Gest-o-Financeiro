/**
 * Migration 019 — correção restrita com aprovação explícita e rollback em divergência.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { authHeaders, E2E_MASTER_EMAIL, E2E_MASTER_SENHA, getCategoriaGlobal, login } from './e2e-auth.helpers';
import { cnpjE2e } from './e2e-cnpj.helpers';
import {
  execMig020,
  inserirAprovacaoTodosElegiveis,
  inserirAprovacaoVigencia,
} from './mig-vigencia-fuso-e2e.helpers';

const CIVIL = '2031-07-10';

/** Corrige todas as vigências elegíveis pendentes para isolar o próximo caso. */
async function drenarElegiveisPendentes(dataSource: DataSource) {
  await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
  await inserirAprovacaoTodosElegiveis(dataSource);
  const [{ n }] = await dataSource.query(
    `SELECT COUNT(*)::int AS n FROM lexius_vigencia_elegivel_correcao_fuso`,
  );
  if (n > 0) {
    await execMig020(dataSource);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
  }
}

async function criarEmpresa(dataSource: DataSource, cnpj: string, fuso: string): Promise<string> {
  const [row] = await dataSource.query(
    `INSERT INTO empresas (tipo, razao_social, cnpj, fuso_negocio)
     VALUES ('OUTRA', $2, $1, $3) RETURNING id`,
    [cnpj, `E2E 019 ${fuso}`, fuso],
  );
  return row.id;
}

async function vincularMaster(dataSource: DataSource, empresaId: string) {
  const [u] = await dataSource.query(`SELECT id FROM usuarios WHERE email = $1`, [E2E_MASTER_EMAIL]);
  await dataSource.query(
    `INSERT INTO usuario_empresa (usuario_id, empresa_id, papel) VALUES ($1, $2, 'MASTER')
     ON CONFLICT DO NOTHING`,
    [u.id, empresaId],
  );
}

async function vigenciaLegadoMenos4(
  dataSource: DataSource,
  empresaId: string,
  tituloId: string,
): Promise<string> {
  const de = `${CIVIL} 00:00:00-04`;
  const [{ id }] = await dataSource.query(
    `INSERT INTO titulo_rateio_vigencia (
      empresa_id, titulo_receber_id, origem, modo, valido_de, valido_ate
    ) VALUES ($1, $2, 'LEGADO', 'PERCENTUAL', $3::timestamptz, NULL) RETURNING id`,
    [empresaId, tituloId, de],
  );
  return id as string;
}

describe('migration 019 — vigência fuso restrita (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let categoriaId: string;

  beforeEach(async () => {
    await drenarElegiveisPendentes(dataSource);
  });

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    ({ token } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
    categoriaId = await getCategoriaGlobal(dataSource, '1.01');
  });

  afterAll(async () => {
    await app.close();
  });

  async function tituloEmpresa(empresaId: string) {
    const t = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: '019 vig',
        categoria_id: categoriaId,
        valor_original: 88,
        data_vencimento: CIVIL,
        data_competencia: CIVIL,
      });
    return t.body.id as string;
  }

  it('LEGADO São Paulo corrigido com aprovação exata', async () => {
    const emp = await criarEmpresa(dataSource, cnpjE2e('mig-019.sp-corrige'), 'America/Sao_Paulo');
    await vincularMaster(dataSource, emp);
    const tid = await tituloEmpresa(emp);
    await dataSource.query(`DELETE FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1`, [tid]);
    const vid = await vigenciaLegadoMenos4(dataSource, emp, tid);

    const [{ lh }] = await dataSource.query(
      `SELECT to_char(valido_de AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS') AS lh
       FROM titulo_rateio_vigencia WHERE id = $1`,
      [vid],
    );
    expect(lh).toBe(`${CIVIL} 01:00:00`);

    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await inserirAprovacaoVigencia(dataSource, vid);
    await execMig020(dataSource);

    const [{ lh_depois }] = await dataSource.query(
      `SELECT to_char(valido_de AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS') AS lh_depois
       FROM titulo_rateio_vigencia WHERE id = $1`,
      [vid],
    );
    expect(lh_depois).toBe(`${CIVIL} 00:00:00`);
  });

  it('LEGADO Rio Branco corrigido', async () => {
    const emp = await criarEmpresa(dataSource, cnpjE2e('mig-019.ac-corrige'), 'America/Rio_Branco');
    await vincularMaster(dataSource, emp);
    const tid = await tituloEmpresa(emp);
    await dataSource.query(`DELETE FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1`, [tid]);
    const vid = await vigenciaLegadoMenos4(dataSource, emp, tid);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await inserirAprovacaoVigencia(dataSource, vid);
    await execMig020(dataSource);
    const [{ lh }] = await dataSource.query(
      `SELECT to_char(valido_de AT TIME ZONE 'America/Rio_Branco', 'YYYY-MM-DD HH24:MI:SS') AS lh
       FROM titulo_rateio_vigencia WHERE id = $1`,
      [vid],
    );
    expect(lh).toBe(`${CIVIL} 00:00:00`);
  });

  it('LEGADO Manaus não entra em elegíveis', async () => {
    const emp = await criarEmpresa(dataSource, cnpjE2e('mig-019.manaus-preserva'), 'America/Manaus');
    await vincularMaster(dataSource, emp);
    const tid = await tituloEmpresa(emp);
    await dataSource.query(`DELETE FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1`, [tid]);
    const vid = await vigenciaLegadoMenos4(dataSource, emp, tid);
    const [antes] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid]);
    const [{ n }] = await dataSource.query(
      `SELECT COUNT(*)::int AS n FROM lexius_vigencia_elegivel_correcao_fuso WHERE vigencia_id = $1`,
      [vid],
    );
    expect(n).toBe(0);
    await execMig020(dataSource);
    const [depois] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid]);
    expect(new Date(depois.valido_de).toISOString()).toBe(new Date(antes.valido_de).toISOString());
  });

  it('CONFIRMACAO com -04 explícito não é corrigida', async () => {
    const emp = await criarEmpresa(dataSource, cnpjE2e('mig-019.confirmacao'), 'America/Sao_Paulo');
    await vincularMaster(dataSource, emp);
    const cc = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(token, emp))
      .send({ codigo: 'CC-CFM', nome: 'CC conf', tipo_no: 'ANALITICO' });
    const tid = await tituloEmpresa(emp);
    const r = await request(app.getHttpServer())
      .post(`/v1/rateio/titulos-receber/${tid}/rascunho`)
      .set(authHeaders(token, emp))
      .send({ modo: 'PERCENTUAL' });
    await request(app.getHttpServer())
      .put(`/v1/rateio/definicoes/${r.body.definicao.id}/itens`)
      .set(authHeaders(token, emp))
      .send({ itens: [{ linha: 1, percentual: 100, centro_custo_id: cc.body.id }] });
    const cfm = await request(app.getHttpServer())
      .post(`/v1/rateio/definicoes/${r.body.definicao.id}/confirmar`)
      .set(authHeaders(token, emp))
      .send({ vigente_desde: `${CIVIL}T00:00:00-04:00` });
    expect(cfm.status).toBe(201);
    const [{ id: vid }] = await dataSource.query(
      `SELECT id FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1 AND origem = 'CONFIRMACAO'`,
      [tid],
    );
    const [{ n }] = await dataSource.query(
      `SELECT COUNT(*)::int AS n FROM lexius_vigencia_elegivel_correcao_fuso WHERE vigencia_id = $1`,
      [vid],
    );
    expect(n).toBe(0);
    const [antes] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid]);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await execMig020(dataSource);
    const [depois] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid]);
    expect(new Date(depois.valido_de).toISOString()).toBe(new Date(antes.valido_de).toISOString());
  });

  it('ID elegível sem aprovação provoca rollback', async () => {
    const emp = await criarEmpresa(dataSource, cnpjE2e('mig-019.sem-aprovacao'), 'America/Sao_Paulo');
    await vincularMaster(dataSource, emp);
    const tid = await tituloEmpresa(emp);
    await dataSource.query(`DELETE FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1`, [tid]);
    const vid = await vigenciaLegadoMenos4(dataSource, emp, tid);
    const [antes] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid]);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await execMig020(dataSource, { expectDivergenciaIds: true });
    const [depois] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid]);
    expect(new Date(depois.valido_de).toISOString()).toBe(new Date(antes.valido_de).toISOString());
  });

  it('divergência de IDs aprovados provoca rollback', async () => {
    const emp = await criarEmpresa(dataSource, cnpjE2e('mig-019.diverge-ids'), 'America/Sao_Paulo');
    await vincularMaster(dataSource, emp);
    const tid1 = await tituloEmpresa(emp);
    await dataSource.query(`DELETE FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1`, [tid1]);
    const vid1 = await vigenciaLegadoMenos4(dataSource, emp, tid1);
    const tid2 = await tituloEmpresa(emp);
    await dataSource.query(`DELETE FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1`, [tid2]);
    const vid2 = await vigenciaLegadoMenos4(dataSource, emp, tid2);
    const [a1] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid1]);
    const [a2] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid2]);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await inserirAprovacaoVigencia(dataSource, vid1);
    await execMig020(dataSource, { expectDivergenciaIds: true });
    const [d1] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid1]);
    const [d2] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid2]);
    expect(new Date(d1.valido_de).toISOString()).toBe(new Date(a1.valido_de).toISOString());
    expect(new Date(d2.valido_de).toISOString()).toBe(new Date(a2.valido_de).toISOString());
  });

  it('alteração de instante após aprovação provoca rollback', async () => {
    const emp = await criarEmpresa(dataSource, cnpjE2e('mig-019.diverge-instante'), 'America/Sao_Paulo');
    await vincularMaster(dataSource, emp);
    const tid = await tituloEmpresa(emp);
    await dataSource.query(`DELETE FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1`, [tid]);
    const vid = await vigenciaLegadoMenos4(dataSource, emp, tid);
    const [antes] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid]);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await inserirAprovacaoVigencia(dataSource, vid);
    await dataSource.query(
      `UPDATE titulo_rateio_vigencia SET valido_de = (($1::date + 1)::text || ' 00:00:00-04')::timestamptz WHERE id = $2`,
      [CIVIL, vid],
    );
    await execMig020(dataSource, { expectDivergenciaSnapshot: true });
    const [depois] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid]);
    expect(new Date(depois.valido_de).toISOString()).not.toBe(new Date(antes.valido_de).toISOString());
  });

  it('segunda execução idempotente após correção', async () => {
    const emp = await criarEmpresa(dataSource, cnpjE2e('mig-019.idempotente'), 'America/Sao_Paulo');
    await vincularMaster(dataSource, emp);
    const tid = await tituloEmpresa(emp);
    await dataSource.query(`DELETE FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1`, [tid]);
    const vid = await vigenciaLegadoMenos4(dataSource, emp, tid);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await inserirAprovacaoVigencia(dataSource, vid);
    await execMig020(dataSource);
    const [corrigido] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid]);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await execMig020(dataSource);
    const [depois] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid]);
    expect(new Date(depois.valido_de).toISOString()).toBe(new Date(corrigido.valido_de).toISOString());
  });

  it('DRE e baixa_alocacao_item preservados após 019', async () => {
    const emp = await criarEmpresa(dataSource, cnpjE2e('mig-019.dre-baixas'), 'America/Sao_Paulo');
    await vincularMaster(dataSource, emp);
    const cc = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(token, emp))
      .send({ codigo: 'CC-019', nome: 'CC 019', tipo_no: 'ANALITICO' });
    const tid = (
      await request(app.getHttpServer())
        .post('/v1/titulos-receber')
        .set(authHeaders(token, emp))
        .send({
          descricao: 'DRE 019',
          categoria_id: categoriaId,
          valor_original: 150,
          data_vencimento: CIVIL,
          data_competencia: CIVIL,
          centro_custo_id: cc.body.id,
        })
    ).body.id as string;
    await dataSource.query(`DELETE FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1`, [tid]);
    const vid = await vigenciaLegadoMenos4(dataSource, emp, tid);
    await dataSource.query(
      `INSERT INTO titulo_rateio_vigencia_item (vigencia_id, empresa_id, linha, centro_custo_id, percentual)
       VALUES ($1, $2, 1, $3, 100)`,
      [vid, emp, cc.body.id],
    );
    const [{ bai_antes }] = await dataSource.query(`SELECT COUNT(*)::int AS bai_antes FROM baixa_alocacao_item`);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await inserirAprovacaoVigencia(dataSource, vid);
    await execMig020(dataSource);
    const [{ bai_depois }] = await dataSource.query(`SELECT COUNT(*)::int AS bai_depois FROM baixa_alocacao_item`);
    expect(bai_depois).toBe(bai_antes);
    const dre = await request(app.getHttpServer())
      .get(`/v1/dre/competencia?de=${CIVIL}&ate=${CIVIL}&natureza=RECEITA`)
      .set(authHeaders(token, emp));
    expect(dre.status).toBe(200);
    expect(dre.body.totais.receitas).toBeGreaterThanOrEqual(150);
  });
});