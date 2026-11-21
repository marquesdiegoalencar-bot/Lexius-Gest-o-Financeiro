/**
 * Auditoria migration 017/018 — conversão DATE→TIMESTAMPTZ por fuso_negocio da empresa.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { authHeaders, E2E_MASTER_EMAIL, E2E_MASTER_SENHA, getCategoriaGlobal, login } from './e2e-auth.helpers';
import { cnpjE2e } from './e2e-cnpj.helpers';
import { inserirAprovacaoTodosElegiveis, MIG021_EXEC } from './mig-vigencia-fuso-e2e.helpers';

const FUSOS = {
  manaus: 'America/Manaus',
  saoPaulo: 'America/Sao_Paulo',
  rioBranco: 'America/Rio_Branco',
} as const;

const CIVIL = '2030-05-20';

async function criarEmpresa(
  dataSource: DataSource,
  cnpj: string,
  fuso: string,
): Promise<string> {
  const [row] = await dataSource.query(
    `INSERT INTO empresas (tipo, razao_social, cnpj, fuso_negocio)
     VALUES ('OUTRA', $2, $1, $3)
     RETURNING id`,
    [cnpj, `E2E Fuso ${fuso}`, fuso],
  );
  return row.id as string;
}

async function vincularMaster(dataSource: DataSource, empresaId: string) {
  const [u] = await dataSource.query(`SELECT id FROM usuarios WHERE email = $1`, [E2E_MASTER_EMAIL]);
  await dataSource.query(
    `INSERT INTO usuario_empresa (usuario_id, empresa_id, papel) VALUES ($1, $2, 'MASTER')
     ON CONFLICT DO NOTHING`,
    [u.id, empresaId],
  );
}

/** Simula vigência pós-017 antiga (offset fixo -04) para um dia civil. */
async function inserirVigenciaAssinaturaMenos4(
  dataSource: DataSource,
  empresaId: string,
  tituloReceberId: string,
  civil: string,
  centroCustoId?: string,
) {
  const de = `${civil} 00:00:00-04`;
  const [{ id: vigenciaId }] = await dataSource.query(
    `INSERT INTO titulo_rateio_vigencia (
      empresa_id, titulo_receber_id, origem, modo, valido_de, valido_ate
    ) VALUES ($1, $2, 'LEGADO', 'PERCENTUAL', $3::timestamptz, NULL)
    RETURNING id`,
    [empresaId, tituloReceberId, de],
  );
  if (centroCustoId) {
    await dataSource.query(
      `INSERT INTO titulo_rateio_vigencia_item (vigencia_id, empresa_id, linha, centro_custo_id, percentual)
       VALUES ($1, $2, 1, $3, 100)`,
      [vigenciaId, empresaId, centroCustoId],
    );
  }
  return de;
}

describe('migration 017/018 — conversão vigência por fuso da empresa (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let masterEmpresaId: string;
  let categoriaId: string;
  let centroId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    ({ token, empresaId: masterEmpresaId } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
    categoriaId = await getCategoriaGlobal(dataSource, '1.01');
    const cc = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(token, masterEmpresaId))
      .send({ codigo: 'CC-MIG', nome: 'CC mig', tipo_no: 'ANALITICO' });
    centroId = cc.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('expressão da 017 corrigida — dia civil preservado por fuso (Manaus, São Paulo, Rio Branco)', async () => {
    const cnpjs = {
      manaus: cnpjE2e('mig-017.expr.manaus'),
      saoPaulo: cnpjE2e('mig-017.expr.saopaulo'),
      rioBranco: cnpjE2e('mig-017.expr.riobranco'),
    };
    for (const [label, fuso] of Object.entries(FUSOS)) {
      await criarEmpresa(dataSource, cnpjs[label as keyof typeof cnpjs], fuso);

      const [expr] = await dataSource.query(
        `SELECT
          ($1::date::timestamp AT TIME ZONE $2)::timestamptz AS correto,
          ($1::text || ' 00:00:00-04')::timestamptz AS legado_menos4`,
        [CIVIL, fuso],
      );

      const localCorreto = await dataSource.query(
        `SELECT to_char($1::timestamptz AT TIME ZONE $2, 'YYYY-MM-DD HH24:MI:SS') AS lh`,
        [expr.correto, fuso],
      );
      expect(localCorreto[0].lh).toBe(`${CIVIL} 00:00:00`);

      if (fuso !== FUSOS.manaus) {
        expect(expr.correto.toISOString()).not.toBe(new Date(expr.legado_menos4).toISOString());
      } else {
        expect(new Date(expr.correto).toISOString()).toBe(new Date(expr.legado_menos4).toISOString());
      }
    }
  });

  it('019 (com aprovação) — reconverte assinatura -04; 018 é no-op; DRE e anti-sobreposição preservados', async () => {
    const empSp = await criarEmpresa(dataSource, cnpjE2e('mig-017-019.sp'), FUSOS.saoPaulo);
    const empAcre = await criarEmpresa(dataSource, cnpjE2e('mig-017-019.acre'), FUSOS.rioBranco);
    await vincularMaster(dataSource, empSp);
    const ccSp = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(token, empSp))
      .send({ codigo: 'CC-SP', nome: 'CC SP', tipo_no: 'ANALITICO' });

    const tituloSp = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empSp))
      .send({
        descricao: 'Mig fuso SP',
        categoria_id: categoriaId,
        valor_original: 100,
        data_vencimento: CIVIL,
        data_competencia: CIVIL,
        centro_custo_id: ccSp.body.id,
      });
    const tituloId = tituloSp.body.id;
    await dataSource.query(`DELETE FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1`, [tituloId]);

    const antes = await inserirVigenciaAssinaturaMenos4(dataSource, empSp, tituloId, CIVIL, ccSp.body.id);
    const [{ lh_antes }] = await dataSource.query(
      `SELECT to_char(valido_de AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS') AS lh_antes
       FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1`,
      [tituloId],
    );
    expect(lh_antes).toBe(`${CIVIL} 01:00:00`);

    const mig018 = readFileSync(join(__dirname, '..', 'migrations', '018_corretiva_vigencia_fuso_por_empresa.sql'), 'utf8');
    await dataSource.query(mig018);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await inserirAprovacaoTodosElegiveis(dataSource);
    await dataSource.query(MIG021_EXEC);

    const [{ lh_depois, iso_depois }] = await dataSource.query(
      `SELECT
        to_char(valido_de AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS') AS lh_depois,
        valido_de::text AS iso_depois
       FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1`,
      [tituloId],
    );
    expect(lh_depois).toBe(`${CIVIL} 00:00:00`);
    expect(iso_depois).not.toContain(antes);

    await vincularMaster(dataSource, empAcre);
    const titAcre = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empAcre))
      .send({
        descricao: 'Mig fuso Acre',
        categoria_id: categoriaId,
        valor_original: 10,
        data_vencimento: CIVIL,
        data_competencia: CIVIL,
      });
    await dataSource.query(`DELETE FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1`, [titAcre.body.id]);
    await inserirVigenciaAssinaturaMenos4(dataSource, empAcre, titAcre.body.id, CIVIL);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await inserirAprovacaoTodosElegiveis(dataSource);
    await dataSource.query(MIG021_EXEC);
    const [{ lh_acre }] = await dataSource.query(
      `SELECT to_char(valido_de AT TIME ZONE 'America/Rio_Branco', 'YYYY-MM-DD HH24:MI:SS') AS lh_acre
       FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1`,
      [titAcre.body.id],
    );
    expect(lh_acre).toBe(`${CIVIL} 00:00:00`);

    const dre = await request(app.getHttpServer())
      .get(`/v1/dre/competencia?de=${CIVIL}&ate=${CIVIL}&natureza=RECEITA`)
      .set(authHeaders(token, empSp));
    expect(dre.status).toBe(200);
    expect(dre.body.totais.receitas).toBeGreaterThanOrEqual(100);

    await expect(
      dataSource.query(
        `INSERT INTO titulo_rateio_vigencia (empresa_id, titulo_receber_id, origem, modo, valido_de, valido_ate)
         VALUES ($1, $2, 'CONFIRMACAO', 'PERCENTUAL', $3::timestamptz, NULL)`,
        [empSp, tituloId, `${CIVIL} 00:00:00-03`],
      ),
    ).rejects.toMatchObject({ message: expect.stringMatching(/sobrepõe/i) });
  });

  it('empresa sem fuso customizado efetivo usa fallback America/Manaus', async () => {
    const empId = await criarEmpresa(dataSource, cnpjE2e('mig-017.fallback-manaus'), 'America/Manaus');
    const [{ correto }] = await dataSource.query(
      `SELECT ($1::date::timestamp AT TIME ZONE COALESCE(NULLIF(TRIM($2), ''), 'America/Manaus'))::timestamptz AS correto`,
      [CIVIL, (await dataSource.query(`SELECT fuso_negocio FROM empresas WHERE id = $1`, [empId]))[0].fuso_negocio],
    );
    const [{ lh }] = await dataSource.query(
      `SELECT to_char($1::timestamptz AT TIME ZONE 'America/Manaus', 'YYYY-MM-DD HH24:MI:SS') AS lh`,
      [correto],
    );
    expect(lh).toBe(`${CIVIL} 00:00:00`);
  });
});