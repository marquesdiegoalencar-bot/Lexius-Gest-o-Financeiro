/**
 * Simulação de publicação 019 (estrutura) + 020 (execução) em banco descartável.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { cnpjE2e } from './e2e-cnpj.helpers';
import {
  execMig020,
  inserirAprovacaoTodosElegiveis,
  inserirAprovacaoVigencia,
  MIG020_EXEC,
} from './mig-vigencia-fuso-e2e.helpers';

const CIVIL = '2032-08-20';
const PREFLIGHT_RAW = readFileSync(
  join(__dirname, '..', 'scripts', 'sql', 'preflight-vigencia-fuso-017-legacy.sql'),
  'utf8',
);

function preflightQuerySql(): string {
  const lines = PREFLIGHT_RAW.split('\n');
  const start = lines.findIndex((l) => l.startsWith('WITH params'));
  const end = lines.findIndex((l) => l.startsWith('\\echo'));
  return lines.slice(start, end).join('\n');
}

describe('simulação publicação migration 019+020 (e2e)', () => {
  let dataSource: DataSource;
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    try {
      await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
      await inserirAprovacaoTodosElegiveis(dataSource);
      const [{ n }] = await dataSource.query(
        `SELECT COUNT(*)::int AS n FROM lexius_vigencia_elegivel_correcao_fuso`,
      );
      if (n > 0) await dataSource.query(MIG020_EXEC);
    } catch {
      await dataSource.query('ROLLBACK').catch(() => undefined);
    }
    await app?.close();
  });

  async function empresaFuso(label: string, fuso: string): Promise<string> {
    const [row] = await dataSource.query(
      `INSERT INTO empresas (tipo, razao_social, cnpj, fuso_negocio)
       VALUES ('OUTRA', $2, $1, $3) RETURNING id`,
      [cnpjE2e(`sim-pub.${label}`), `Sim 019 ${label}`, fuso],
    );
    return row.id as string;
  }

  async function legadoMenos4(empresaId: string, fuso: string): Promise<string> {
    const [cat] = await dataSource.query(`SELECT id FROM categorias WHERE codigo = '1.01' LIMIT 1`);
    const [tit] = await dataSource.query(
      `INSERT INTO titulos_receber (
        empresa_id, categoria_id, descricao, valor_original, data_vencimento, data_competencia, status
      ) VALUES ($1, $2, $3, 10, $4, $4, 'ABERTO') RETURNING id`,
      [empresaId, cat.id, `Tit ${fuso}`, CIVIL],
    );
    const de = `${CIVIL} 00:00:00-04`;
    const [{ id }] = await dataSource.query(
      `INSERT INTO titulo_rateio_vigencia (empresa_id, titulo_receber_id, origem, modo, valido_de, valido_ate)
       VALUES ($1, $2, 'LEGADO', 'PERCENTUAL', $3::timestamptz, NULL) RETURNING id`,
      [empresaId, tit.id, de],
    );
    return id as string;
  }

  it('fluxo completo: pré-flight → aprovação com snapshots → 020 → divergência → idempotência', async () => {
    const vidSp = await legadoMenos4(await empresaFuso('sp', 'America/Sao_Paulo'), 'America/Sao_Paulo');
    const vidAcre = await legadoMenos4(await empresaFuso('acre', 'America/Rio_Branco'), 'America/Rio_Branco');
    const vidManaus = await legadoMenos4(await empresaFuso('manaus', 'America/Manaus'), 'America/Manaus');

    const pre = await dataSource.query(preflightQuerySql());
    const classeA = pre.filter((r: { classificacao: string }) => r.classificacao === 'A');
    expect(classeA.length).toBeGreaterThanOrEqual(2);
    expect(pre.find((r: { vigencia_id: string }) => r.vigencia_id === vidManaus)?.classificacao).toBe('B');
    const [{ nmanus }] = await dataSource.query(
      `SELECT COUNT(*)::int AS nmanus FROM lexius_vigencia_elegivel_correcao_fuso WHERE vigencia_id = $1`,
      [vidManaus],
    );
    expect(nmanus).toBe(0);

    const antesSp = await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vidSp]);

    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await inserirAprovacaoVigencia(dataSource, vidSp);
    await execMig020(dataSource, { expectDivergenciaIds: true });

    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await inserirAprovacaoTodosElegiveis(dataSource);
    await dataSource.query(MIG020_EXEC);

    const [{ lh }] = await dataSource.query(
      `SELECT to_char(valido_de AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS') AS lh
       FROM titulo_rateio_vigencia WHERE id = $1`,
      [vidSp],
    );
    expect(lh).toBe(`${CIVIL} 00:00:00`);
    expect(antesSp[0].valido_de).not.toEqual(
      (await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vidSp]))[0].valido_de,
    );

    const manausAntes = (
      await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vidManaus])
    )[0];
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await execMig020(dataSource);
    const manausDepois = (
      await dataSource.query(`SELECT valido_de FROM titulo_rateio_vigencia WHERE id = $1`, [vidManaus])
    )[0];
    expect(new Date(manausDepois.valido_de).toISOString()).toBe(new Date(manausAntes.valido_de).toISOString());

    const [{ n }] = await dataSource.query(`SELECT COUNT(*)::int AS n FROM lexius_vigencia_elegivel_correcao_fuso`);
    expect(n).toBe(0);
    void vidAcre;
  });
});