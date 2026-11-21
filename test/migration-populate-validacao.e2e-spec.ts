/**
 * Validações transacionais do populate-aprovacao-vigencia-fuso.sql
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { cnpjE2e } from './e2e-cnpj.helpers';
import {
  inserirAprovacaoVigencia,
  limparAprovacoesPendentes,
  POPULATE_APROVACAO,
} from './mig-vigencia-fuso-e2e.helpers';

const CIVIL = '2036-03-10';

describe('populate aprovação vigência — validações (e2e)', () => {
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

  afterAll(async () => app.close());

  async function legadoSp(scope: string): Promise<string> {
    const [emp] = await dataSource.query(
      `INSERT INTO empresas (tipo, razao_social, cnpj, fuso_negocio)
       VALUES ('OUTRA', $2, $1, 'America/Sao_Paulo') RETURNING id`,
      [cnpjE2e(`pop.${scope}`), `Pop ${scope}`],
    );
    const [cat] = await dataSource.query(`SELECT id FROM categorias WHERE codigo = '1.01' LIMIT 1`);
    const [tit] = await dataSource.query(
      `INSERT INTO titulos_receber (empresa_id, categoria_id, descricao, valor_original, data_vencimento, data_competencia, status)
       VALUES ($1, $2, 'p', 1, $3, $3, 'ABERTO') RETURNING id`,
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

  it('rejeita snapshot pendente incompleto antes do INSERT', async () => {
    const vid = await legadoSp('incompleto');
    await limparAprovacoesPendentes(dataSource);
    await dataSource.query(`INSERT INTO lexius_mig_vigencia_fuso_aprovacao (vigencia_id) VALUES ($1)`, [vid]);
    await expect(dataSource.query(POPULATE_APROVACAO)).rejects.toMatchObject({
      message: expect.stringMatching(/snapshot incompleto/i),
    });
    await dataSource.query('ROLLBACK').catch(() => undefined);
    await limparAprovacoesPendentes(dataSource);
  });

  it('rejeita reaproveitar vigência com aprovação já concluída', async () => {
    const vid = await legadoSp('concluida');
    await limparAprovacoesPendentes(dataSource);
    await inserirAprovacaoVigencia(dataSource, vid);
    await dataSource.query(
      `UPDATE lexius_mig_vigencia_fuso_aprovacao SET correcao_aplicada_em = now(), lote_execucao = gen_random_uuid()
       WHERE vigencia_id = $1`,
      [vid],
    );
    const [{ n }] = await dataSource.query(
      `SELECT COUNT(*)::int AS n FROM lexius_vigencia_elegivel_correcao_fuso WHERE vigencia_id = $1`,
      [vid],
    );
    expect(n).toBe(1);
    await expect(dataSource.query(POPULATE_APROVACAO)).rejects.toMatchObject({
      message: expect.stringMatching(/já possui aprovação concluída/i),
    });
    await dataSource.query('ROLLBACK').catch(() => undefined);
    await dataSource.query(
      `DELETE FROM lexius_mig_vigencia_fuso_aprovacao WHERE vigencia_id = $1`,
      [vid],
    );
  });

  it('populate transacional insere elegível válido', async () => {
    const vid = await legadoSp('ok');
    await limparAprovacoesPendentes(dataSource);
    await dataSource.query(POPULATE_APROVACAO);
    const [row] = await dataSource.query(
      `SELECT empresa_id_aprovado, novo_valido_de_aprovado FROM lexius_mig_vigencia_fuso_aprovacao WHERE vigencia_id = $1`,
      [vid],
    );
    expect(row.empresa_id_aprovado).toBeTruthy();
    expect(row.novo_valido_de_aprovado).toBeTruthy();
    await limparAprovacoesPendentes(dataSource);
  });
});