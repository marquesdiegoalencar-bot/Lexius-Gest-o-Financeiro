/**
 * Auditoria migration 019 (estrutura) + 020 (execução) — snapshots e sequência operacional.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { cnpjE2e } from './e2e-cnpj.helpers';
import { E2E_MASTER_EMAIL, getCategoriaGlobal, login } from './e2e-auth.helpers';
import {
  execMig020,
  inserirAprovacaoTodosElegiveis,
  inserirAprovacaoVigencia,
  MIG019_ESTRUTURA,
  MIG020_EXEC,
} from './mig-vigencia-fuso-e2e.helpers';

const CIVIL = '2033-09-01';

describe('auditoria migration 020 — snapshots e integridade (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    await login(app, E2E_MASTER_EMAIL, 'Lexius@123');
    await getCategoriaGlobal(dataSource, '1.01');
  });

  beforeEach(async () => {
    await dataSource.query('ROLLBACK').catch(() => undefined);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`).catch(() => undefined);
    await inserirAprovacaoTodosElegiveis(dataSource);
    const [{ n }] = await dataSource.query(
      `SELECT COUNT(*)::int AS n FROM lexius_vigencia_elegivel_correcao_fuso`,
    );
    if (n > 0) {
      await dataSource.query(MIG020_EXEC).catch(() => dataSource.query('ROLLBACK'));
    }
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
  });

  afterAll(async () => {
    await app.close();
  });

  async function legadoSp(scope: string): Promise<{ vid: string; emp: string }> {
    const [emp] = await dataSource.query(
      `INSERT INTO empresas (tipo, razao_social, cnpj, fuso_negocio)
       VALUES ('OUTRA', $2, $1, 'America/Sao_Paulo') RETURNING id`,
      [cnpjE2e(`audit-020.${scope}`), `Audit SP ${scope}`],
    );
    const [cat] = await dataSource.query(`SELECT id FROM categorias WHERE codigo = '1.01' LIMIT 1`);
    const [tit] = await dataSource.query(
      `INSERT INTO titulos_receber (empresa_id, categoria_id, descricao, valor_original, data_vencimento, data_competencia, status)
       VALUES ($1, $2, 'audit', 1, $3, $3, 'ABERTO') RETURNING id`,
      [emp.id, cat.id, CIVIL],
    );
    const de = `${CIVIL} 00:00:00-04`;
    const [{ id: vid }] = await dataSource.query(
      `INSERT INTO titulo_rateio_vigencia (empresa_id, titulo_receber_id, origem, modo, valido_de, valido_ate)
       VALUES ($1, $2, 'LEGADO', 'PERCENTUAL', $3::timestamptz, NULL) RETURNING id`,
      [emp.id, tit.id, de],
    );
    return { vid, emp: emp.id as string };
  }

  it('020 sem 019 — tabela inexistente após drop', async () => {
    await dataSource.query(`DROP TABLE IF EXISTS lexius_mig_vigencia_fuso_aprovacao CASCADE`);
    await execMig020(dataSource, { expectEstruturaAusente: true });
    await dataSource.query(MIG019_ESTRUTURA);
  });

  it('aprovação incompleta — somente vigencia_id', async () => {
    const { vid } = await legadoSp('incompleta');
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await dataSource.query(`INSERT INTO lexius_mig_vigencia_fuso_aprovacao (vigencia_id) VALUES ($1)`, [vid]);
    await execMig020(dataSource, { expectAprovacaoIncompleta: true });
  });

  it('aprovações órfãs — elegível corrigido mas snapshot permanece', async () => {
    const { vid } = await legadoSp('orfas');
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await inserirAprovacaoVigencia(dataSource, vid);
    await dataSource.query(MIG020_EXEC);
    await execMig020(dataSource, { expectAprovacoesOrfas: true });
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
  });

  it('alteração de fuso após aprovação', async () => {
    const { vid, emp } = await legadoSp('fuso');
    await inserirAprovacaoVigencia(dataSource, vid);
    await dataSource.query(`UPDATE empresas SET fuso_negocio = 'America/Manaus' WHERE id = $1`, [emp]);
    await expect(dataSource.query(MIG020_EXEC)).rejects.toMatchObject({
      message: expect.stringMatching(/Divergência|órfãs/i),
    });
    await dataSource.query('ROLLBACK').catch(() => undefined);
    await dataSource.query(`UPDATE empresas SET fuso_negocio = 'America/Sao_Paulo' WHERE id = $1`, [emp]);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
  });

  it('alteração de empresa_id na vigência após aprovação', async () => {
    const { vid, emp } = await legadoSp('empresa');
    const [outra] = await dataSource.query(
      `INSERT INTO empresas (tipo, razao_social, cnpj, fuso_negocio)
       VALUES ('OUTRA', 'Outra audit', $1, 'America/Sao_Paulo') RETURNING id`,
      [cnpjE2e('audit-020.empresa-troca')],
    );
    await inserirAprovacaoVigencia(dataSource, vid);
    await dataSource.query(`UPDATE titulo_rateio_vigencia SET empresa_id = $1 WHERE id = $2`, [outra.id, vid]);
    await expect(dataSource.query(MIG020_EXEC)).rejects.toMatchObject({
      message: expect.stringMatching(/Divergência|órfãs/i),
    });
    await dataSource.query('ROLLBACK').catch(() => undefined);
    await dataSource.query(`UPDATE titulo_rateio_vigencia SET empresa_id = $1 WHERE id = $2`, [emp, vid]);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
  });

  it('alteração de origem após aprovação', async () => {
    const { vid } = await legadoSp('origem');
    await inserirAprovacaoVigencia(dataSource, vid);
    await dataSource.query(
      `UPDATE titulo_rateio_vigencia SET origem = 'CONFIRMACAO' WHERE id = $1`,
      [vid],
    );
    await expect(dataSource.query(MIG020_EXEC)).rejects.toMatchObject({
      message: expect.stringMatching(/Divergência|órfãs/i),
    });
    await dataSource.query('ROLLBACK').catch(() => undefined);
    await dataSource.query(`UPDATE titulo_rateio_vigencia SET origem = 'LEGADO' WHERE id = $1`, [vid]);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
  });

  it('IDs extras na aprovação', async () => {
    const sp = await legadoSp('extras');
    const [empM] = await dataSource.query(
      `INSERT INTO empresas (tipo, razao_social, cnpj, fuso_negocio)
       VALUES ('OUTRA', 'Audit Manaus', $1, 'America/Manaus') RETURNING id`,
      [cnpjE2e('audit-020.manaus-extra')],
    );
    const [cat] = await dataSource.query(`SELECT id FROM categorias WHERE codigo = '1.01' LIMIT 1`);
    const [tit] = await dataSource.query(
      `INSERT INTO titulos_receber (empresa_id, categoria_id, descricao, valor_original, data_vencimento, data_competencia, status)
       VALUES ($1, $2, 'm', 1, $3, $3, 'ABERTO') RETURNING id`,
      [empM.id, cat.id, CIVIL],
    );
    const [{ id: vidManaus }] = await dataSource.query(
      `INSERT INTO titulo_rateio_vigencia (empresa_id, titulo_receber_id, origem, modo, valido_de, valido_ate)
       VALUES ($1, $2, 'LEGADO', 'PERCENTUAL', $3::timestamptz, NULL) RETURNING id`,
      [empM.id, tit.id, `${CIVIL} 00:00:00-04`],
    );
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await inserirAprovacaoVigencia(dataSource, sp.vid);
    await inserirAprovacaoVigencia(dataSource, vidManaus);
    await execMig020(dataSource, { expectDivergenciaIds: true });
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
  });

  it('sequência 019→popular→020 preserva baixa_alocacao_item', async () => {
    const { vid } = await legadoSp('historico');
    const [{ bai }] = await dataSource.query(`SELECT COUNT(*)::int AS bai FROM baixa_alocacao_item`);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
    await inserirAprovacaoTodosElegiveis(dataSource);
    await dataSource.query(MIG020_EXEC);
    const [{ bai: baiDepois }] = await dataSource.query(`SELECT COUNT(*)::int AS bai FROM baixa_alocacao_item`);
    expect(baiDepois).toBe(bai);
    const [{ count }] = await dataSource.query(
      `SELECT COUNT(*)::int AS count FROM titulo_rateio_vigencia WHERE id = $1`,
      [vid],
    );
    expect(count).toBe(1);
    await dataSource.query(`TRUNCATE lexius_mig_vigencia_fuso_aprovacao`);
  });
});