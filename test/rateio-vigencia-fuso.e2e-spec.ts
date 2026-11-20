import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { competenciaParaInstante } from '../src/common/financeiro/fuso-negocio';
import { RateioService } from '../src/modules/rateio/rateio.service';
import {
  authHeaders,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SENHA,
  getCategoriaGlobal,
  login,
} from './e2e-auth.helpers';

describe('rateio — vigência TIMESTAMPTZ, fuso e intervalo [início, fim) (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let rateio: RateioService;
  let token: string;
  let empresaId: string;
  let categoriaId: string;
  let centroId: string;

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
    rateio = moduleFixture.get(RateioService);

    ({ token, empresaId } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
    categoriaId = await getCategoriaGlobal(dataSource, '1.01');
    const cc = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(token, empresaId))
      .send({ codigo: 'CC-VIG', nome: 'CC vigência', tipo_no: 'ANALITICO' });
    centroId = cc.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function tituloEVigencias(
    desc: string,
    vig1: string,
    vig2: string,
  ): Promise<{ tituloId: string; vRows: { valido_de: Date; valido_ate: Date | null }[] }> {
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: desc,
        categoria_id: categoriaId,
        valor_original: 100,
        data_vencimento: vig1,
        data_competencia: vig1,
      });
    const tituloId = criar.body.id;

    const fluxo = async (desde: string) => {
      const r = await request(app.getHttpServer())
        .post(`/v1/rateio/titulos-receber/${tituloId}/rascunho`)
        .set(authHeaders(token, empresaId))
        .send({ modo: 'PERCENTUAL' });
      const defId = r.body.definicao.id;
      await request(app.getHttpServer())
        .put(`/v1/rateio/definicoes/${defId}/itens`)
        .set(authHeaders(token, empresaId))
        .send({ itens: [{ linha: 1, centro_custo_id: centroId, percentual: 100 }] });
      await request(app.getHttpServer())
        .post(`/v1/rateio/definicoes/${defId}/confirmar`)
        .set(authHeaders(token, empresaId))
        .send({ vigente_desde: desde });
    };

    await fluxo(vig1);
    await fluxo(vig2);

    const vRows = await dataSource.query(
      `SELECT valido_de, valido_ate FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1 ORDER BY valido_de`,
      [tituloId],
    );
    return { tituloId, vRows };
  }

  it('migration 017 — vigência LEGADO guarda início civil em America/Manaus (TIMESTAMPTZ)', async () => {
    const inicio = competenciaParaInstante('2029-03-10', 'America/Manaus');
    expect(inicio).toMatch(/T04:00:00\.000Z/);

    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'Legado TZ',
        categoria_id: categoriaId,
        valor_original: 1,
        data_vencimento: '2029-03-10',
        data_competencia: '2029-03-10',
        centro_custo_id: centroId,
      });
    const [{ local_hora }] = await dataSource.query(
      `SELECT to_char(valido_de AT TIME ZONE 'America/Manaus', 'YYYY-MM-DD HH24:MI:SS') AS local_hora
       FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1`,
      [criar.body.id],
    );
    expect(local_hora).toBe('2029-03-10 00:00:00');
  });

  it('duas vigências consecutivas — fim exclusivo da primeira = início da segunda', async () => {
    const { tituloId, vRows } = await tituloEVigencias('Vig consec', '2028-01-01', '2028-02-01');
    expect(vRows.length).toBe(2);
    expect(vRows[0]!.valido_ate).not.toBeNull();
    const fimPrimeira = new Date(vRows[0]!.valido_ate!).toISOString();
    const inicioSegunda = new Date(vRows[1]!.valido_de).toISOString();
    expect(fimPrimeira).toBe(inicioSegunda);
    expect(vRows[1]!.valido_ate).toBeNull();

    const instInicio2 = inicioSegunda;
    const vigNoLimite = await dataSource.transaction((manager) =>
      rateio.vigenciaVigenteNaData(manager, empresaId, { receberId: tituloId }, instInicio2),
    );
    expect(vigNoLimite?.validoDe?.toISOString()).toBe(inicioSegunda);

    const antesFim = new Date(new Date(inicioSegunda).getTime() - 1);
    const vigAntes = await dataSource.transaction((manager) =>
      rateio.vigenciaVigenteNaData(manager, empresaId, { receberId: tituloId }, antesFim.toISOString()),
    );
    expect(vigAntes?.validoDe?.toISOString()).toBe(new Date(vRows[0]!.valido_de).toISOString());
  });

  it('mesmo dia com horários distintos — sem sobreposição', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'Vig mesmo dia',
        categoria_id: categoriaId,
        valor_original: 50,
        data_vencimento: '2028-06-15',
        data_competencia: '2028-06-15',
      });
    const tituloId = criar.body.id;

    const confirmar = async (iso: string) => {
      const r = await request(app.getHttpServer())
        .post(`/v1/rateio/titulos-receber/${tituloId}/rascunho`)
        .set(authHeaders(token, empresaId))
        .send({ modo: 'PERCENTUAL' });
      await request(app.getHttpServer())
        .put(`/v1/rateio/definicoes/${r.body.definicao.id}/itens`)
        .set(authHeaders(token, empresaId))
        .send({ itens: [{ linha: 1, centro_custo_id: centroId, percentual: 100 }] });
      return request(app.getHttpServer())
        .post(`/v1/rateio/definicoes/${r.body.definicao.id}/confirmar`)
        .set(authHeaders(token, empresaId))
        .send({ vigente_desde: iso });
    };

    expect((await confirmar('2028-06-15T08:00:00-04:00')).status).toBe(201);
    expect((await confirmar('2028-06-15T14:00:00-04:00')).status).toBe(201);

    const meio = await dataSource.transaction((manager) =>
      rateio.vigenciaVigenteNaData(
        manager,
        empresaId,
        { receberId: tituloId },
        '2028-06-15T11:00:00-04:00',
      ),
    );
    expect(meio).toBeDefined();
    const vigCount = await dataSource.query(
      `SELECT COUNT(*)::int AS c FROM titulo_rateio_vigencia WHERE titulo_receber_id = $1`,
      [tituloId],
    );
    expect(vigCount[0].c).toBe(2);
  });

  it('DRE histórica respeita vigência vigente na data de competência', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'DRE vig hist',
        categoria_id: categoriaId,
        valor_original: 300,
        data_vencimento: '2028-03-01',
        data_competencia: '2028-03-15',
        centro_custo_id: centroId,
      });
    const tituloId = criar.body.id;
    const r = await request(app.getHttpServer())
      .post(`/v1/rateio/titulos-receber/${tituloId}/rascunho`)
      .set(authHeaders(token, empresaId))
      .send({ modo: 'PERCENTUAL' });
    await request(app.getHttpServer())
      .put(`/v1/rateio/definicoes/${r.body.definicao.id}/itens`)
      .set(authHeaders(token, empresaId))
      .send({ itens: [{ linha: 1, centro_custo_id: centroId, percentual: 100 }] });
    await request(app.getHttpServer())
      .post(`/v1/rateio/definicoes/${r.body.definicao.id}/confirmar`)
      .set(authHeaders(token, empresaId))
      .send({ vigente_desde: '2028-03-01' });

    const dre = await request(app.getHttpServer())
      .get('/v1/dre/competencia?de=2028-03-01&ate=2028-03-31&natureza=RECEITA')
      .set(authHeaders(token, empresaId));
    expect(dre.status).toBe(200);
    expect(dre.body.totais.receitas).toBeGreaterThanOrEqual(300);
  });
});