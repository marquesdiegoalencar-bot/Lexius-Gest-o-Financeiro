import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { FormaPagamento } from '../src/database/enums';
import {
  authHeaders,
  criarContaBancaria,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SENHA,
  getCategoriaGlobal,
  login,
} from './e2e-auth.helpers';

describe('rateio Bloco E (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let empresaId: string;
  let categoriaId: string;
  let contaId: string;
  let centroId: string;
  let departamentoId: string;

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

    const tabelas = ['titulo_alocacao_definicao', 'baixa_alocacao_item', 'titulo_rateio_vigencia'];
    for (const t of tabelas) {
      const [{ exists }] = await dataSource.query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1
        ) AS exists`,
        [t],
      );
      expect(exists).toBe(true);
    }

    ({ token, empresaId } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
    categoriaId = await getCategoriaGlobal(dataSource, '1.01');
    contaId = await criarContaBancaria(app, token, empresaId);

    const cc = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(token, empresaId))
      .send({ codigo: 'CC-RATEIO', nome: 'CC Rateio E2E', tipo_no: 'ANALITICO' });
    expect(cc.status).toBe(201);
    centroId = cc.body.id;

    const dep = await request(app.getHttpServer())
      .post('/v1/departamentos')
      .set(authHeaders(token, empresaId))
      .send({ codigo: 'DEP-RATEIO', nome: 'Dept Rateio' });
    expect(dep.status).toBe(201);
    departamentoId = dep.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('confirma rateio percentual e propaga alocação na baixa', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TR rateio E2E',
        categoria_id: categoriaId,
        valor_original: 100,
        data_vencimento: '2026-08-01',
        data_competencia: '2026-08-15',
      });
    expect(criar.status).toBe(201);
    const tituloId = criar.body.id;

    const rascunho = await request(app.getHttpServer())
      .post(`/v1/rateio/titulos-receber/${tituloId}/rascunho`)
      .set(authHeaders(token, empresaId))
      .send({ modo: 'PERCENTUAL' });
    expect(rascunho.status).toBe(201);
    const definicaoId = rascunho.body.definicao.id;

    const salvar = await request(app.getHttpServer())
      .put(`/v1/rateio/definicoes/${definicaoId}/itens`)
      .set(authHeaders(token, empresaId))
      .send({
        itens: [
          { linha: 1, centro_custo_id: centroId, percentual: 60 },
          { linha: 2, departamento_id: departamentoId, percentual: 40 },
        ],
      });
    expect(salvar.status).toBe(200);

    const confirmar = await request(app.getHttpServer())
      .post(`/v1/rateio/definicoes/${definicaoId}/confirmar`)
      .set(authHeaders(token, empresaId))
      .send({ vigente_desde: '2026-08-01' });
    expect(confirmar.status).toBe(201);
    expect(confirmar.body.vigencia.origem).toBe('CONFIRMACAO');

    const baixa = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${tituloId}/baixar`)
      .set(authHeaders(token, empresaId))
      .send({
        conta_bancaria_id: contaId,
        data_baixa: '2026-08-10',
        valor_principal: 100,
        forma: FormaPagamento.PIX,
      });
    expect(baixa.status).toBe(201);
    const baixaId = baixa.body.baixa.id;

    const rows = await dataSource.query(
      `SELECT linha, valor::float, tipo FROM baixa_alocacao_item WHERE baixa_id = $1 ORDER BY linha`,
      [baixaId],
    );
    expect(rows.length).toBe(2);
    expect(rows[0].tipo).toBe('BAIXA');
    const soma = rows.reduce((s: number, r: { valor: number }) => s + r.valor, 0);
    expect(soma).toBeCloseTo(100, 2);
    expect(rows[0].valor).toBeCloseTo(60, 2);
    expect(rows[1].valor).toBeCloseTo(40, 2);
  });

  it('estorno gera linhas ESTORNO negativas', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TR estorno rateio',
        categoria_id: categoriaId,
        valor_original: 50,
        data_vencimento: '2026-09-01',
        centro_custo_id: centroId,
      });
    const tituloId = criar.body.id;

    const baixa = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${tituloId}/baixar`)
      .set(authHeaders(token, empresaId))
      .send({
        conta_bancaria_id: contaId,
        data_baixa: '2026-09-05',
        valor_principal: 50,
        forma: FormaPagamento.PIX,
      });
    const baixaId = baixa.body.baixa.id;

    const estorno = await request(app.getHttpServer())
      .post(`/v1/baixas/${baixaId}/estornar`)
      .set(authHeaders(token, empresaId))
      .send({ motivo: 'teste rateio estorno' });
    expect(estorno.status).toBe(201);

    const est = await dataSource.query(
      `SELECT valor::float, tipo FROM baixa_alocacao_item WHERE baixa_id = $1 AND tipo = 'ESTORNO'`,
      [baixaId],
    );
    expect(est.length).toBe(1);
    expect(est[0].valor).toBeCloseTo(-50, 2);
  });

  it('nova confirmação substitui anterior (SUPERSEDED) sem duas CONFIRMADO', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TR supersede',
        categoria_id: categoriaId,
        valor_original: 200,
        data_vencimento: '2026-10-01',
        data_competencia: '2026-10-01',
      });
    const tituloId = criar.body.id;

    const r1 = await request(app.getHttpServer())
      .post(`/v1/rateio/titulos-receber/${tituloId}/rascunho`)
      .set(authHeaders(token, empresaId))
      .send({ modo: 'PERCENTUAL' });
    const def1 = r1.body.definicao.id;
    await request(app.getHttpServer())
      .put(`/v1/rateio/definicoes/${def1}/itens`)
      .set(authHeaders(token, empresaId))
      .send({ itens: [{ linha: 1, centro_custo_id: centroId, percentual: 100 }] });
    await request(app.getHttpServer())
      .post(`/v1/rateio/definicoes/${def1}/confirmar`)
      .set(authHeaders(token, empresaId))
      .send({ vigente_desde: '2026-10-01' });

    const r2 = await request(app.getHttpServer())
      .post(`/v1/rateio/titulos-receber/${tituloId}/rascunho`)
      .set(authHeaders(token, empresaId))
      .send({ modo: 'PERCENTUAL' });
    const def2 = r2.body.definicao.id;
    await request(app.getHttpServer())
      .put(`/v1/rateio/definicoes/${def2}/itens`)
      .set(authHeaders(token, empresaId))
      .send({ itens: [{ linha: 1, departamento_id: departamentoId, percentual: 100 }] });
    await request(app.getHttpServer())
      .post(`/v1/rateio/definicoes/${def2}/confirmar`)
      .set(authHeaders(token, empresaId))
      .send({ vigente_desde: '2026-11-01' });

    const hist = await request(app.getHttpServer())
      .get(`/v1/rateio/titulos-receber/${tituloId}/historico`)
      .set(authHeaders(token, empresaId));
    expect(hist.status).toBe(200);
    const statuses = hist.body.map((d: { status: string }) => d.status);
    expect(statuses.filter((s: string) => s === 'CONFIRMADO').length).toBe(1);
    expect(statuses).toContain('SUPERSEDED');

    const confirmados = await dataSource.query(
      `SELECT COUNT(*)::int AS c FROM titulo_alocacao_definicao
       WHERE titulo_receber_id = $1 AND status = 'CONFIRMADO'`,
      [tituloId],
    );
    expect(confirmados[0].c).toBe(1);
  });

  it('título a pagar — modo valor fixo soma ao valor do título', async () => {
    const catDesp = await getCategoriaGlobal(dataSource, '2.01');
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-pagar')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TP valor fixo',
        categoria_id: catDesp,
        valor_original: 90,
        data_vencimento: '2027-04-01',
      });
    const tituloId = criar.body.id;

    const rasc = await request(app.getHttpServer())
      .post(`/v1/rateio/titulos-pagar/${tituloId}/rascunho`)
      .set(authHeaders(token, empresaId))
      .send({ modo: 'VALOR_FIXO' });
    const defId = rasc.body.definicao.id;
    const salvar = await request(app.getHttpServer())
      .put(`/v1/rateio/definicoes/${defId}/itens`)
      .set(authHeaders(token, empresaId))
      .send({
        itens: [
          { linha: 1, centro_custo_id: centroId, valor: 54 },
          { linha: 2, departamento_id: departamentoId, valor: 36 },
        ],
      });
    expect(salvar.status).toBe(200);

    const confirmar = await request(app.getHttpServer())
      .post(`/v1/rateio/definicoes/${defId}/confirmar`)
      .set(authHeaders(token, empresaId))
      .send({ vigente_desde: '2027-04-01' });
    expect(confirmar.status).toBe(201);

    const hist = await request(app.getHttpServer())
      .get(`/v1/rateio/titulos-pagar/${tituloId}/historico`)
      .set(authHeaders(token, empresaId));
    expect(hist.status).toBe(200);
    expect(hist.body.some((d: { status: string }) => d.status === 'CONFIRMADO')).toBe(true);
  });

  it('cancela rascunho e impede cancelar confirmado', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TR cancel',
        categoria_id: categoriaId,
        valor_original: 10,
        data_vencimento: '2027-05-01',
      });
    const tituloId = criar.body.id;

    const rasc = await request(app.getHttpServer())
      .post(`/v1/rateio/titulos-receber/${tituloId}/rascunho`)
      .set(authHeaders(token, empresaId))
      .send({ modo: 'PERCENTUAL' });
    const defId = rasc.body.definicao.id;

    const cancel = await request(app.getHttpServer())
      .patch(`/v1/rateio/definicoes/${defId}/cancelar`)
      .set(authHeaders(token, empresaId));
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('CANCELADO');

    const rasc2 = await request(app.getHttpServer())
      .post(`/v1/rateio/titulos-receber/${tituloId}/rascunho`)
      .set(authHeaders(token, empresaId))
      .send({ modo: 'PERCENTUAL' });
    const def2 = rasc2.body.definicao.id;
    await request(app.getHttpServer())
      .put(`/v1/rateio/definicoes/${def2}/itens`)
      .set(authHeaders(token, empresaId))
      .send({ itens: [{ linha: 1, centro_custo_id: centroId, percentual: 100 }] });
    await request(app.getHttpServer())
      .post(`/v1/rateio/definicoes/${def2}/confirmar`)
      .set(authHeaders(token, empresaId))
      .send({ vigente_desde: '2027-05-01' });

    const block = await request(app.getHttpServer())
      .patch(`/v1/rateio/definicoes/${def2}/cancelar`)
      .set(authHeaders(token, empresaId));
    expect(block.status).toBe(409);
  });
});