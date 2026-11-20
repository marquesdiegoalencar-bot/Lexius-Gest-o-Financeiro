/**
 * Concorrência determinística — ordem de lock departamento → centro (Bloco D).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, QueryRunner } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Departamento } from '../src/database/entities/departamento.entity';
import { CentroCusto } from '../src/database/entities/centro-custo.entity';
import {
  authHeaders,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SENHA,
  getCategoriaGlobal,
  login,
} from './e2e-auth.helpers';

describe('dimensões — concorrência determinística (dept → CC)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let empresaId: string;
  let categoriaReceitaId: string;

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
    ({ token, empresaId } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
    categoriaReceitaId = await getCategoriaGlobal(dataSource, '1.01');
  });

  afterAll(async () => {
    await app.close();
  });

  async function withRunner<T>(fn: (runner: QueryRunner) => Promise<T>): Promise<T> {
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    try {
      return await fn(runner);
    } finally {
      await runner.release();
    }
  }

  async function comLocksDeptECentro(
    deptId: string,
    centroId: string,
    mutate: (manager: QueryRunner['manager']) => Promise<void>,
    fnB: () => Promise<{ status: number }>,
  ) {
    let bStatus = 0;
    await withRunner(async (runnerA) => {
      await runnerA.startTransaction();
      await runnerA.manager.findOne(Departamento, {
        where: { id: deptId, empresaId },
        lock: { mode: 'pessimistic_write' },
      });
      await runnerA.manager.findOne(CentroCusto, {
        where: { id: centroId, empresaId },
        lock: { mode: 'pessimistic_write' },
      });
      await mutate(runnerA.manager);
      const bPromise = fnB().then((r) => {
        bStatus = r.status;
      });
      await runnerA.commitTransaction();
      await bPromise;
    });
    return bStatus;
  }

  it('inativa departamento enquanto vínculo em título é criado — rejeita vínculo com dimensão inativa', async () => {
    const dep = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(token, empresaId))
      .send({ codigo: 'DEP-CONC', nome: 'Dept conc' });
    const cc = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(token, empresaId))
      .send({ codigo: 'CC-CONC', nome: 'CC conc', tipo_no: 'ANALITICO' });
    const deptId = dep.body.id as string;
    const centroId = cc.body.id as string;

    const status = await comLocksDeptECentro(
      deptId,
      centroId,
      async (manager) => {
        const d = await manager.findOne(Departamento, { where: { id: deptId, empresaId } });
        if (d) {
          d.ativo = false;
          await manager.save(Departamento, d);
        }
      },
      () =>
        request(app.getHttpServer())
          .post('/v1/titulos-receber')
          .set(authHeaders(token, empresaId))
          .send({
            descricao: 'TR conc dims',
            categoria_id: categoriaReceitaId,
            valor_original: 10,
            data_vencimento: '2032-01-01',
            departamento_id: deptId,
            centro_custo_id: centroId,
          }),
    );

    expect([400, 409, 422]).toContain(status);

    const ativos = await dataSource.query(
      `SELECT COUNT(*)::int AS c FROM titulos_receber
       WHERE departamento_id = $1 AND centro_custo_id = $2 AND descricao = 'TR conc dims'`,
      [deptId, centroId],
    );
    expect(ativos[0].c).toBe(0);
  });
});