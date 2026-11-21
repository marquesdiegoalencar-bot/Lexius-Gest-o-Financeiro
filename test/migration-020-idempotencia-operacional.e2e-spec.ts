/**
 * Idempotência operacional da 020 — trilha correcao_aplicada_em sem TRUNCATE.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { cnpjE2e } from './e2e-cnpj.helpers';
import {
  drenarElegiveisPendentes,
  execMig020,
  inserirAprovacaoTodosElegiveis,
  inserirAprovacaoVigencia,
  limparAprovacoesPendentes,
  MIG021_EXEC,
} from './mig-vigencia-fuso-e2e.helpers';

const CIVIL = '2034-01-15';

describe('migration 020 — idempotência operacional (e2e)', () => {
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
    await app.close();
  });

  beforeEach(async () => {
    await drenarElegiveisPendentes(dataSource);
  });

  async function legadoSp(scope: string): Promise<string> {
    const [emp] = await dataSource.query(
      `INSERT INTO empresas (tipo, razao_social, cnpj, fuso_negocio)
       VALUES ('OUTRA', $2, $1, 'America/Sao_Paulo') RETURNING id`,
      [cnpjE2e(`idempot-020.${scope}`), `Idemp ${scope}`],
    );
    const [cat] = await dataSource.query(`SELECT id FROM categorias WHERE codigo = '1.01' LIMIT 1`);
    const [tit] = await dataSource.query(
      `INSERT INTO titulos_receber (empresa_id, categoria_id, descricao, valor_original, data_vencimento, data_competencia, status)
       VALUES ($1, $2, 'idemp', 1, $3, $3, 'ABERTO') RETURNING id`,
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

  it('primeira execução marca correcao_aplicada_em e preserva linha de auditoria', async () => {
    const vid = await legadoSp('primeira');
    await limparAprovacoesPendentes(dataSource);
    await inserirAprovacaoVigencia(dataSource, vid);
    await dataSource.query(MIG021_EXEC);
    const [{ ts, lote }] = await dataSource.query(
      `SELECT correcao_aplicada_em AS ts, lote_execucao AS lote
       FROM lexius_mig_vigencia_fuso_aprovacao WHERE vigencia_id = $1`,
      [vid],
    );
    expect(ts).toBeTruthy();
    expect(lote).toBeTruthy();
    const [{ n }] = await dataSource.query(
      `SELECT COUNT(*)::int AS n FROM lexius_vigencia_elegivel_correcao_fuso`,
    );
    expect(n).toBe(0);
  });

  it('repetição imediata da 020 é idempotente (aprovções concluídas permanecem)', async () => {
    const vid = await legadoSp('repetir');
    await limparAprovacoesPendentes(dataSource);
    await inserirAprovacaoVigencia(dataSource, vid);
    await dataSource.query(MIG021_EXEC);
    await dataSource.query(MIG021_EXEC);
    const [{ cnt }] = await dataSource.query(
      `SELECT COUNT(*)::int AS cnt FROM lexius_mig_vigencia_fuso_aprovacao WHERE vigencia_id = $1`,
      [vid],
    );
    expect(cnt).toBe(1);
  });

  it('aprovação pendente órfã sem elegíveis provoca exceção', async () => {
    const [empM] = await dataSource.query(
      `INSERT INTO empresas (tipo, razao_social, cnpj, fuso_negocio)
       VALUES ('OUTRA', 'Orfã Manaus', $1, 'America/Manaus') RETURNING id`,
      [cnpjE2e('idempot-020.orfa-manaus')],
    );
    const [cat] = await dataSource.query(`SELECT id FROM categorias WHERE codigo = '1.01' LIMIT 1`);
    const [tit] = await dataSource.query(
      `INSERT INTO titulos_receber (empresa_id, categoria_id, descricao, valor_original, data_vencimento, data_competencia, status)
       VALUES ($1, $2, 'orfã', 1, $3, $3, 'ABERTO') RETURNING id`,
      [empM.id, cat.id, CIVIL],
    );
    const [{ id: vidManaus }] = await dataSource.query(
      `INSERT INTO titulo_rateio_vigencia (empresa_id, titulo_receber_id, origem, modo, valido_de, valido_ate)
       VALUES ($1, $2, 'LEGADO', 'PERCENTUAL', $3::timestamptz, NULL) RETURNING id`,
      [empM.id, tit.id, `${CIVIL} 00:00:00-04`],
    );
    await limparAprovacoesPendentes(dataSource);
    await inserirAprovacaoVigencia(dataSource, vidManaus);
    await execMig020(dataSource, { expectAprovacoesOrfas: true });
    await limparAprovacoesPendentes(dataSource);
  });

  it('nova rodada legítima: novo elegível após ciclo anterior', async () => {
    const vid1 = await legadoSp('lote-a');
    await limparAprovacoesPendentes(dataSource);
    await inserirAprovacaoVigencia(dataSource, vid1);
    await dataSource.query(MIG021_EXEC);

    const vid2 = await legadoSp('lote-b');
    await limparAprovacoesPendentes(dataSource);
    await inserirAprovacaoVigencia(dataSource, vid2);
    await dataSource.query(MIG021_EXEC);

    const [{ n }] = await dataSource.query(
      `SELECT COUNT(*)::int AS n FROM lexius_mig_vigencia_fuso_aprovacao WHERE correcao_aplicada_em IS NOT NULL`,
    );
    expect(n).toBeGreaterThanOrEqual(2);
  });

  it('não reaproveita snapshot concluído via populate', async () => {
    const vid = await legadoSp('snapshot-lock');
    await limparAprovacoesPendentes(dataSource);
    await inserirAprovacaoVigencia(dataSource, vid);
    await dataSource.query(MIG021_EXEC);
    const [antes] = await dataSource.query(
      `SELECT valido_de_aprovado, correcao_aplicada_em FROM lexius_mig_vigencia_fuso_aprovacao WHERE vigencia_id = $1`,
      [vid],
    );
    await dataSource.query(
      `UPDATE titulo_rateio_vigencia SET valido_de = ($1::date + 2 || ' 00:00:00-04')::timestamptz WHERE id = $2`,
      [CIVIL, vid],
    );
    await limparAprovacoesPendentes(dataSource);
    await inserirAprovacaoTodosElegiveis(dataSource);
    const [depois] = await dataSource.query(
      `SELECT valido_de_aprovado, correcao_aplicada_em FROM lexius_mig_vigencia_fuso_aprovacao WHERE vigencia_id = $1`,
      [vid],
    );
    expect(depois.correcao_aplicada_em).toEqual(antes.correcao_aplicada_em);
    expect(new Date(depois.valido_de_aprovado).toISOString()).toBe(
      new Date(antes.valido_de_aprovado).toISOString(),
    );
  });
});