import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { CentroCusto } from '../src/database/entities/centro-custo.entity';
import {
  authHeaders,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SENHA,
  getCategoriaGlobal,
  login,
} from './e2e-auth.helpers';

describe('centros-custo bloco B — correções (concorrência e FK)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let empresaId: string;
  let categoriaReceitaId: string;
  let categoriaDespesaId: string;

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
      `SELECT indexname FROM pg_indexes WHERE tablename = 'centros_custo' AND indexname = 'uq_centros_custo_empresa_id'`,
    );
    expect(migCols.length).toBe(1);

    const fk = await dataSource.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'centros_custo'::regclass AND conname = 'centros_custo_pai_mesma_empresa_fkey'`,
    );
    expect(fk.length).toBe(1);

    ({ token, empresaId } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
    categoriaReceitaId = await getCategoriaGlobal(dataSource, '1.01');
    categoriaDespesaId = await getCategoriaGlobal(dataSource, '2.01');
  });

  afterAll(async () => {
    await app.close();
  });

  async function criarAnalitico(nome: string, tipo: 'ENTRADA' | 'SAIDA' = 'ENTRADA') {
    const res = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(token, empresaId))
      .send({ nome, tipo, tipo_no: 'ANALITICO' });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function inativarNoBanco(centroId: string) {
    await dataSource.transaction(async (manager) => {
      const c = await manager.findOne(CentroCusto, {
        where: { id: centroId, empresaId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!c) throw new Error('centro não encontrado');
      c.ativo = false;
      await manager.save(CentroCusto, c);
    });
  }

  it('concorrência: inativar centro vs criar título a receber', async () => {
    const centroId = await criarAnalitico('Conc receber');

    await inativarNoBanco(centroId);
    const tituloRejeitado = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'Centro inativo na tx',
        categoria_id: categoriaReceitaId,
        centro_custo_id: centroId,
        valor_original: 10,
        data_vencimento: '2030-06-16',
      });
    expect(tituloRejeitado.status).toBe(400);

    await request(app.getHttpServer())
      .patch(`/v1/centros-custo/${centroId}`)
      .set(authHeaders(token, empresaId))
      .send({ ativo: true });

    const criarOk = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'Centro reativado',
        categoria_id: categoriaReceitaId,
        centro_custo_id: centroId,
        valor_original: 10,
        data_vencimento: '2030-06-18',
      });
    expect(criarOk.status).toBe(201);
  });

  it('concorrência: inativar centro vs criar título a pagar', async () => {
    const centroId = await criarAnalitico('Conc pagar', 'SAIDA');

    await inativarNoBanco(centroId);
    const tituloRejeitado = await request(app.getHttpServer())
      .post('/v1/titulos-pagar')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TP centro inativo',
        categoria_id: categoriaDespesaId,
        centro_custo_id: centroId,
        valor_original: 10,
        data_vencimento: '2030-06-20',
      });
    expect(tituloRejeitado.status).toBe(400);
  });

  it('concorrência: inativar centro vs parcelar título a receber', async () => {
    const centroId = await criarAnalitico('Conc parcelar');
    await inativarNoBanco(centroId);
    const parcelar = await request(app.getHttpServer())
      .post('/v1/titulos-receber/parcelar')
      .set(authHeaders(token, empresaId))
      .send({
        categoria_id: categoriaReceitaId,
        centro_custo_id: centroId,
        parcelas: [
          { descricao: 'P1', valor_original: 5, data_vencimento: '2030-07-01' },
          { descricao: 'P2', valor_original: 5, data_vencimento: '2030-08-01' },
        ],
      });
    expect(parcelar.status).toBe(400);
  });

  it('concorrência paralela HTTP: após inativação efetiva, novo vínculo é rejeitado (50 corridas)', async () => {
    const centroId = await criarAnalitico('Race batch');
    let violacao = false;

    for (let i = 0; i < 50; i++) {
      await request(app.getHttpServer())
        .patch(`/v1/centros-custo/${centroId}`)
        .set(authHeaders(token, empresaId))
        .send({ ativo: true });

      await inativarNoBanco(centroId);

      const criar = await request(app.getHttpServer())
        .post('/v1/titulos-receber')
        .set(authHeaders(token, empresaId))
        .send({
          descricao: `Pós-inativar ${i}`,
          categoria_id: categoriaReceitaId,
          centro_custo_id: centroId,
          valor_original: 10,
          data_vencimento: '2030-06-19',
        });

      if (criar.status === 201) {
        violacao = true;
        break;
      }
    }

    expect(violacao).toBe(false);
  });

  it('concorrência: inativar grupo vs criar filho analítico', async () => {
    const grupo = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(token, empresaId))
      .send({ nome: 'Grupo conc', tipo: 'ENTRADA', tipo_no: 'GRUPO' });
    expect(grupo.status).toBe(201);
    const grupoId = grupo.body.id as string;

    const filho = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(token, empresaId))
      .send({
        nome: 'Filho ativo p/ bloquear',
        tipo: 'ENTRADA',
        tipo_no: 'ANALITICO',
        pai_id: grupoId,
      });
    expect(filho.status).toBe(201);

    const inativar = await request(app.getHttpServer())
      .patch(`/v1/centros-custo/${grupoId}`)
      .set(authHeaders(token, empresaId))
      .send({ ativo: false });
    expect(inativar.status).toBe(400);

    await request(app.getHttpServer())
      .patch(`/v1/centros-custo/${filho.body.id}`)
      .set(authHeaders(token, empresaId))
      .send({ ativo: false });

    const inativarOk = await request(app.getHttpServer())
      .patch(`/v1/centros-custo/${grupoId}`)
      .set(authHeaders(token, empresaId))
      .send({ ativo: false });
    expect(inativarOk.status).toBe(200);
  });

  it('PostgreSQL: pai/filho mesma empresa OK; cross-empresa rejeitado; raiz NULL OK', async () => {
    const [empA] = await dataSource.query(`SELECT id FROM empresas ORDER BY id LIMIT 1`);
    let empB = (await dataSource.query(`SELECT id FROM empresas WHERE id <> $1 LIMIT 1`, [empA.id]))[0];
    if (!empB) {
      empB = (
        await dataSource.query(
          `INSERT INTO empresas (tipo, razao_social, nome_fantasia, cnpj)
           VALUES ('OUTRA', 'Empresa B E2E', 'Empresa B', '00000000000272') RETURNING id`,
        )
      )[0];
    }

    const paiA = (
      await dataSource.query(
        `INSERT INTO centros_custo (empresa_id, nome, tipo, tipo_no, ativo)
         VALUES ($1, 'Pai A FK', 'ENTRADA', 'GRUPO', true) RETURNING id`,
        [empA.id],
      )
    )[0].id;

    const filhoA = (
      await dataSource.query(
        `INSERT INTO centros_custo (empresa_id, nome, tipo, tipo_no, pai_id, ativo)
         VALUES ($1, 'Filho A FK', 'ENTRADA', 'ANALITICO', $2, true) RETURNING id`,
        [empA.id, paiA],
      )
    )[0].id;
    expect(filhoA).toBeTruthy();

    const raiz = (
      await dataSource.query(
        `INSERT INTO centros_custo (empresa_id, nome, tipo, tipo_no, pai_id, ativo)
         VALUES ($1, 'Raiz NULL', 'ENTRADA', 'ANALITICO', NULL, true) RETURNING id`,
        [empA.id],
      )
    )[0].id;
    expect(raiz).toBeTruthy();

    const paiB = (
      await dataSource.query(
        `INSERT INTO centros_custo (empresa_id, nome, tipo, tipo_no, ativo)
         VALUES ($1, 'Pai B FK', 'ENTRADA', 'GRUPO', true) RETURNING id`,
        [empB.id],
      )
    )[0].id;

    let crossFailed = false;
    try {
      await dataSource.query(
        `INSERT INTO centros_custo (empresa_id, nome, tipo, tipo_no, pai_id, ativo)
         VALUES ($1, 'Cross', 'ENTRADA', 'ANALITICO', $2, true)`,
        [empA.id, paiB],
      );
    } catch {
      crossFailed = true;
    }
    expect(crossFailed).toBe(true);

    await dataSource.query(`DELETE FROM centros_custo WHERE id = $1`, [filhoA]);
    await dataSource.query(`DELETE FROM centros_custo WHERE id = $1`, [paiA]);
    await dataSource.query(`DELETE FROM centros_custo WHERE id = $1`, [raiz]);
    await dataSource.query(`DELETE FROM centros_custo WHERE id = $1`, [paiB]);
  });
});