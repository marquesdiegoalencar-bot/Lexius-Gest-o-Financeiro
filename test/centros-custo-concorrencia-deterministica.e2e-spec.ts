/**
 * Concorrência determinística — duas conexões com coordenação explícita.
 * Ordem de lock: operações no mesmo centro/pai serializam na mesma linha (pessimistic_write).
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, QueryRunner } from 'typeorm';
import { AppModule } from '../src/app.module';
import { CentroCusto } from '../src/database/entities/centro-custo.entity';
import { TituloReceber } from '../src/database/entities/titulo-receber.entity';
import { CentrosCustoService } from '../src/modules/centros-custo/centros-custo.service';
import {
  authHeaders,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SENHA,
  getCategoriaGlobal,
  login,
} from './e2e-auth.helpers';

describe('centros-custo — concorrência determinística (2 conexões)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let centrosCusto: CentrosCustoService;
  let token: string;
  let empresaId: string;
  let categoriaReceitaId: string;
  let categoriaDespesaId: string;
  let usuarioId: string;

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
    centrosCusto = moduleFixture.get(CentrosCustoService);
    ({ token, empresaId } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
    categoriaReceitaId = await getCategoriaGlobal(dataSource, '1.01');
    categoriaDespesaId = await getCategoriaGlobal(dataSource, '2.01');
    const [u] = await dataSource.query(`SELECT id FROM usuarios WHERE email = $1`, [E2E_MASTER_EMAIL]);
    usuarioId = u.id;
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

  /** Conexão A mantém FOR UPDATE sem commit; fnB dispara enquanto A segura o lock; depois A commita. */
  async function comLockRetidoNaConexaoA(
    centroId: string,
    mutate: (manager: QueryRunner['manager']) => Promise<void>,
    fnB: () => Promise<{ status: number }>,
  ) {
    let bStatus = 0;
    await withRunner(async (runnerA) => {
      await runnerA.startTransaction();
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

  async function contarTitulosReceber(centroId: string): Promise<number> {
    const [{ count }] = await dataSource.query(
      `SELECT COUNT(*)::int AS count FROM titulos_receber WHERE centro_custo_id = $1`,
      [centroId],
    );
    return count;
  }

  async function criarAnalitico(nome: string, tipo: 'ENTRADA' | 'SAIDA' = 'ENTRADA') {
    const res = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(token, empresaId))
      .send({ nome, tipo, tipo_no: 'ANALITICO' });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  describe('inativação vs vínculo — ordem inativar primeiro na conexão A', () => {
    it('título a receber: centro inativo antes do commit do vínculo → rejeitado, zero novos títulos', async () => {
      const centroId = await criarAnalitico('Det TR inativar-A');
      const antes = await contarTitulosReceber(centroId);

      const status = await comLockRetidoNaConexaoA(
        centroId,
        async (manager) => {
          const c = await manager.findOne(CentroCusto, { where: { id: centroId, empresaId } });
          if (!c) throw new Error('centro');
          c.ativo = false;
          await manager.save(CentroCusto, c);
        },
        () =>
          request(app.getHttpServer())
            .post('/v1/titulos-receber')
            .set(authHeaders(token, empresaId))
            .send({
              descricao: 'Det inativar primeiro',
              categoria_id: categoriaReceitaId,
              centro_custo_id: centroId,
              valor_original: 10,
              data_vencimento: '2031-01-01',
            }),
      );

      expect(status).toBe(400);
      expect(await contarTitulosReceber(centroId)).toBe(antes);
      const [{ ativo }] = await dataSource.query(`SELECT ativo FROM centros_custo WHERE id = $1`, [centroId]);
      expect(ativo).toBe(false);
    });

    it('título a pagar: mesmo critério', async () => {
      const centroId = await criarAnalitico('Det TP inativar-A', 'SAIDA');

      const status = await comLockRetidoNaConexaoA(
        centroId,
        async (manager) => {
          const c = await manager.findOne(CentroCusto, { where: { id: centroId, empresaId } });
          c!.ativo = false;
          await manager.save(CentroCusto, c!);
        },
        () =>
          request(app.getHttpServer())
            .post('/v1/titulos-pagar')
            .set(authHeaders(token, empresaId))
            .send({
              descricao: 'Det TP',
              categoria_id: categoriaDespesaId,
              centro_custo_id: centroId,
              valor_original: 10,
              data_vencimento: '2031-01-02',
            }),
      );

      expect(status).toBe(400);
    });

    it('parcelamento: nenhuma parcela persistida se centro inativado na conexão A', async () => {
      const centroId = await criarAnalitico('Det parc inativar-A');
      const antes = await contarTitulosReceber(centroId);

      const status = await comLockRetidoNaConexaoA(
        centroId,
        async (manager) => {
          const c = await manager.findOne(CentroCusto, { where: { id: centroId, empresaId } });
          c!.ativo = false;
          await manager.save(CentroCusto, c!);
        },
        () =>
          request(app.getHttpServer())
            .post('/v1/titulos-receber/parcelar')
            .set(authHeaders(token, empresaId))
            .send({
              categoria_id: categoriaReceitaId,
              centro_custo_id: centroId,
              parcelas: [
                { descricao: 'x1', valor_original: 5, data_vencimento: '2031-02-01' },
                { descricao: 'x2', valor_original: 5, data_vencimento: '2031-03-01' },
              ],
            }),
      );

      expect(status).toBe(400);
      expect(await contarTitulosReceber(centroId)).toBe(antes);
    });
  });

  describe('inativação vs vínculo — ordem vínculo após centro ainda ativo na conexão A', () => {
    it('título a receber: A segura lock sem inativar; B cria título; A commita → sucesso', async () => {
      const centroId = await criarAnalitico('Det TR ativo-A');
      const antes = await contarTitulosReceber(centroId);

      const status = await comLockRetidoNaConexaoA(
        centroId,
        async () => {
          /* mantém ativo */
        },
        () =>
          request(app.getHttpServer())
            .post('/v1/titulos-receber')
            .set(authHeaders(token, empresaId))
            .send({
              descricao: 'Det ativo durante lock',
              categoria_id: categoriaReceitaId,
              centro_custo_id: centroId,
              valor_original: 10,
              data_vencimento: '2031-01-03',
            }),
      );

      expect(status).toBe(201);
      expect(await contarTitulosReceber(centroId)).toBe(antes + 1);
    });

    it('conexão B transacional: após A inativar e commitar, assertVinculoFinanceiroTx falha', async () => {
      const centroId = await criarAnalitico('Det serviço B');

      let bError: string | null = null;
      await withRunner(async (runnerA) => {
        await runnerA.startTransaction();
        const c = await runnerA.manager.findOne(CentroCusto, {
          where: { id: centroId, empresaId },
          lock: { mode: 'pessimistic_write' },
        });
        c!.ativo = false;
        await runnerA.manager.save(CentroCusto, c!);
        const bTx = (async () => {
          try {
            await dataSource.transaction(async (manager) => {
              await centrosCusto.assertVinculoFinanceiroTx(manager, empresaId, centroId);
              await manager.save(
                TituloReceber,
                manager.create(TituloReceber, {
                  empresaId,
                  descricao: 'Não deve gravar',
                  categoriaId: categoriaReceitaId,
                  centroCustoId: centroId,
                  valorOriginal: '10.00',
                  dataVencimento: '2031-01-04',
                  criadoPor: usuarioId,
                }),
              );
            });
          } catch (e) {
            bError = e instanceof Error ? e.message : String(e);
          }
        })();
        await runnerA.commitTransaction();
        await bTx;
      });

      expect(bError).toMatch(/analíticos ativos/i);
      expect(await contarTitulosReceber(centroId)).toBe(0);
    });
  });

  describe('hierarquia — disputa no mesmo nó pai', () => {
    async function criarGrupo(nome: string) {
      const res = await request(app.getHttpServer())
        .post('/v1/centros-custo')
        .set(authHeaders(token, empresaId))
        .send({ nome, tipo: 'ENTRADA', tipo_no: 'GRUPO' });
      expect(res.status).toBe(201);
      return res.body.id as string;
    }

    it('inativar GRUPO (conexão A) vs criar SUBGRUPO (HTTP) — filho não criado se pai inativado na A', async () => {
      const grupoId = await criarGrupo('Hier Grupo-Sub');

      const status = await comLockRetidoNaConexaoA(
        grupoId,
        async (manager) => {
          const g = await manager.findOne(CentroCusto, { where: { id: grupoId, empresaId } });
          g!.ativo = false;
          await manager.save(CentroCusto, g!);
        },
        () =>
          request(app.getHttpServer())
            .post('/v1/centros-custo')
            .set(authHeaders(token, empresaId))
            .send({
              nome: 'Sub concorrente',
              tipo: 'ENTRADA',
              tipo_no: 'SUBGRUPO',
              pai_id: grupoId,
            }),
      );

      expect(status).toBe(400);
      const filhos = await dataSource.query(
        `SELECT id FROM centros_custo WHERE pai_id = $1 AND tipo_no = 'SUBGRUPO'`,
        [grupoId],
      );
      expect(filhos.length).toBe(0);
    });

    it('inativar GRUPO (A) vs criar ANALITICO filho — bloqueado se pai inativo', async () => {
      const grupoId = await criarGrupo('Hier Grupo-Ana');

      const status = await comLockRetidoNaConexaoA(
        grupoId,
        async (manager) => {
          const g = await manager.findOne(CentroCusto, { where: { id: grupoId, empresaId } });
          g!.ativo = false;
          await manager.save(CentroCusto, g!);
        },
        () =>
          request(app.getHttpServer())
            .post('/v1/centros-custo')
            .set(authHeaders(token, empresaId))
            .send({
              nome: 'Ana concorrente',
              tipo: 'ENTRADA',
              tipo_no: 'ANALITICO',
              pai_id: grupoId,
            }),
      );

      expect(status).toBe(400);
    });

    it('inativar SUBGRUPO (A) vs criar ANALITICO — bloqueado se subgrupo inativado', async () => {
      const grupoId = await criarGrupo('Hier base');
      const sub = await request(app.getHttpServer())
        .post('/v1/centros-custo')
        .set(authHeaders(token, empresaId))
        .send({ nome: 'Sub', tipo: 'ENTRADA', tipo_no: 'SUBGRUPO', pai_id: grupoId });
      const subId = sub.body.id as string;

      const status = await comLockRetidoNaConexaoA(
        subId,
        async (manager) => {
          const s = await manager.findOne(CentroCusto, { where: { id: subId, empresaId } });
          s!.ativo = false;
          await manager.save(CentroCusto, s!);
        },
        () =>
          request(app.getHttpServer())
            .post('/v1/centros-custo')
            .set(authHeaders(token, empresaId))
            .send({
              nome: 'Ana sob sub',
              tipo: 'ENTRADA',
              tipo_no: 'ANALITICO',
              pai_id: subId,
            }),
      );

      expect(status).toBe(400);
    });

    it('GRUPO com filho ativo: inativação API falha; após inativar filho, inativação API ok', async () => {
      const grupoId = await criarGrupo('Hier desc');
      const filho = await request(app.getHttpServer())
        .post('/v1/centros-custo')
        .set(authHeaders(token, empresaId))
        .send({
          nome: 'Filho ativo',
          tipo: 'ENTRADA',
          tipo_no: 'ANALITICO',
          pai_id: grupoId,
        });
      expect(filho.status).toBe(201);

      const bloqueio = await request(app.getHttpServer())
        .patch(`/v1/centros-custo/${grupoId}`)
        .set(authHeaders(token, empresaId))
        .send({ ativo: false });
      expect(bloqueio.status).toBe(400);

      await request(app.getHttpServer())
        .patch(`/v1/centros-custo/${filho.body.id}`)
        .set(authHeaders(token, empresaId))
        .send({ ativo: false });

      const ok = await request(app.getHttpServer())
        .patch(`/v1/centros-custo/${grupoId}`)
        .set(authHeaders(token, empresaId))
        .send({ ativo: false });
      expect(ok.status).toBe(200);
    });

    it('mover filho para outro pai enquanto inativa pai antigo (A inativa P1, HTTP move filho)', async () => {
      const p1 = await criarGrupo('P1 move');
      const p2 = await criarGrupo('P2 move');
      const filho = await request(app.getHttpServer())
        .post('/v1/centros-custo')
        .set(authHeaders(token, empresaId))
        .send({
          nome: 'Filho move',
          tipo: 'ENTRADA',
          tipo_no: 'ANALITICO',
          pai_id: p1,
        });
      const filhoId = filho.body.id as string;

      const moveStatus = await comLockRetidoNaConexaoA(
        p1,
        async (manager) => {
          const p = await manager.findOne(CentroCusto, { where: { id: p1, empresaId } });
          p!.ativo = false;
          await manager.save(CentroCusto, p!);
        },
        () =>
          request(app.getHttpServer())
            .patch(`/v1/centros-custo/${filhoId}`)
            .set(authHeaders(token, empresaId))
            .send({ pai_id: p2 }),
      );

      expect([200, 400]).toContain(moveStatus);
      const row = (
        await dataSource.query(`SELECT pai_id, ativo FROM centros_custo WHERE id = $1`, [p1])
      )[0];
      expect(row.ativo).toBe(false);
      if (moveStatus === 200) {
        const filhoRow = (
          await dataSource.query(`SELECT pai_id FROM centros_custo WHERE id = $1`, [filhoId])
        )[0];
        expect(filhoRow.pai_id).toBe(p2);
      }
    });
  });
});