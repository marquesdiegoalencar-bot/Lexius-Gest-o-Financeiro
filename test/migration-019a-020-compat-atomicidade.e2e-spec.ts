/**
 * Compatibilidade b5dcbdb (019/020 sem trilha) + 019a + atomicidade transacional da 020.
 */
import { join } from 'path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { cnpjE2e } from './e2e-cnpj.helpers';
import { execSync } from 'child_process';
import { limparAprovacoesPendentes, MIG019A_TRILHA, MIG021_EXEC } from './mig-vigencia-fuso-e2e.helpers';

const CIVIL = '2035-02-01';
const MIG020_PUBLISHED = execSync(
  'git show b5dcbdb:migrations/020_corretiva_vigencia_legado_fuso_exec.sql',
  { encoding: 'utf8', cwd: join(__dirname, '..') },
);

describe('compat 019 publicada + 019a + atomicidade 020 (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.query(MIG019A_TRILHA).catch(() => undefined);
    await app.close();
  });

  async function legadoSp(scope: string): Promise<string> {
    const [emp] = await dataSource.query(
      `INSERT INTO empresas (tipo, razao_social, cnpj, fuso_negocio)
       VALUES ('OUTRA', $2, $1, 'America/Sao_Paulo') RETURNING id`,
      [cnpjE2e(`compat.${scope}`), scope],
    );
    const [cat] = await dataSource.query(`SELECT id FROM categorias WHERE codigo = '1.01' LIMIT 1`);
    const [tit] = await dataSource.query(
      `INSERT INTO titulos_receber (empresa_id, categoria_id, descricao, valor_original, data_vencimento, data_competencia, status)
       VALUES ($1, $2, 'c', 1, $3, $3, 'ABERTO') RETURNING id`,
      [emp.id, cat.id, CIVIL],
    );
    const de = `${CIVIL} 00:00:00-04`;
    const [{ id: vid }] = await dataSource.query(
      `INSERT INTO titulo_rateio_vigencia (empresa_id, titulo_receber_id, origem, modo, valido_de, valido_ate)
       VALUES ($1, $2, 'LEGADO', 'PERCENTUAL', $3::timestamptz, NULL) RETURNING id`,
      [emp.id, tit.id, de],
    );
    return vid as string;
  }

  async function inserirAprovacaoLegado(dataSource: DataSource, vigenciaId: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO lexius_mig_vigencia_fuso_aprovacao (
        vigencia_id, empresa_id_aprovado, origem_aprovada, fuso_negocio_aprovado,
        valido_de_aprovado, valido_ate_aprovado, novo_valido_de_aprovado, novo_valido_ate_aprovado
      )
      SELECT v.id, v.empresa_id, v.origem,
        COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus'),
        v.valido_de, v.valido_ate,
        (((v.valido_de AT TIME ZONE '-04')::date)::timestamp AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus'))::timestamptz,
        CASE WHEN v.valido_ate IS NULL THEN NULL ELSE
          (((v.valido_ate AT TIME ZONE '-04')::date)::timestamp AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus'))::timestamptz END
      FROM titulo_rateio_vigencia v
      INNER JOIN empresas e ON e.id = v.empresa_id
      WHERE v.id = $1
      ON CONFLICT (vigencia_id) DO UPDATE SET
        empresa_id_aprovado = EXCLUDED.empresa_id_aprovado,
        novo_valido_de_aprovado = EXCLUDED.novo_valido_de_aprovado`,
      [vigenciaId],
    );
  }

  it('B) banco pré-existente: sem trilha → 020 b5dcbdb → 019a backfill → 020 idempotente', async () => {
    await dataSource.query(`
      ALTER TABLE lexius_mig_vigencia_fuso_aprovacao
        DROP COLUMN IF EXISTS correcao_aplicada_em,
        DROP COLUMN IF EXISTS lote_execucao`);

    const vid = await legadoSp('preexistente');
    await limparAprovacoesPendentes(dataSource).catch(() => undefined);
    await inserirAprovacaoLegado(dataSource, vid);
    await dataSource.query(MIG020_PUBLISHED);

    const [vPos] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid]);

    await dataSource.query(MIG019A_TRILHA);

    const [{ ts }] = await dataSource.query(
      `SELECT correcao_aplicada_em AS ts FROM lexius_mig_vigencia_fuso_aprovacao WHERE vigencia_id = $1`,
      [vid],
    );
    expect(ts).toBeTruthy();

    await dataSource.query(MIG021_EXEC);
    const [vDepois] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid]);
    expect(new Date(vDepois.valido_de).toISOString()).toBe(new Date(vPos.valido_de).toISOString());
  });

  it('A) banco novo: colunas 019a presentes após cadeia reset-db (019+019a+020)', async () => {
    const [{ ok }] = await dataSource.query(
      `SELECT (
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'lexius_mig_vigencia_fuso_aprovacao'
            AND column_name = 'correcao_aplicada_em'
        )
      ) AS ok`,
    );
    expect(ok).toBe(true);
  });

  it('atomicidade: falha após UPDATE de vigência reverte correção e trilha', async () => {
    const vid = await legadoSp('atomic');
    await limparAprovacoesPendentes(dataSource);
    await inserirAprovacaoLegado(dataSource, vid);
    const [antes] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid]);

    await dataSource.query(`
      CREATE OR REPLACE FUNCTION lexius_e2e_abort_vigencia_update() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'e2e abort após tentativa de correção';
      END;
      $$ LANGUAGE plpgsql`);
    await dataSource.query(`
      DROP TRIGGER IF EXISTS lexius_e2e_abort_vigencia_update ON titulo_rateio_vigencia`);
    await dataSource.query(`
      CREATE TRIGGER lexius_e2e_abort_vigencia_update
      BEFORE UPDATE ON titulo_rateio_vigencia
      FOR EACH ROW EXECUTE FUNCTION lexius_e2e_abort_vigencia_update()`);

    try {
      await dataSource.query(MIG021_EXEC);
      fail('020 deveria falhar com trigger de abort');
    } catch (e) {
      expect((e as Error).message).toMatch(/e2e abort/);
    }
    await dataSource.query('ROLLBACK').catch(() => undefined);

    const [depois] = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vid]);
    const [trail] = await dataSource.query(
      `SELECT correcao_aplicada_em FROM lexius_mig_vigencia_fuso_aprovacao WHERE vigencia_id = $1`,
      [vid],
    );
    expect(new Date(depois.valido_de).toISOString()).toBe(new Date(antes.valido_de).toISOString());
    expect(trail.correcao_aplicada_em).toBeNull();

    await dataSource.query(`DROP TRIGGER IF EXISTS lexius_e2e_abort_vigencia_update ON titulo_rateio_vigencia`);
    await dataSource.query(`DROP FUNCTION IF EXISTS lexius_e2e_abort_vigencia_update()`);
    await limparAprovacoesPendentes(dataSource);
  });
});