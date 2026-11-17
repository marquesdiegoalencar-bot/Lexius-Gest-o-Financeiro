import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  authHeaders,
  criarContaBancaria,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SENHA,
  login,
} from './e2e-auth.helpers';
import { buildAcordoExemploSpec, E2E_COB_API_KEY, signCobBody } from './cob-integracao.helpers';

describe('Fase 4A — repasses (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let empresaId: string;
  let contaId: string;
  let credorId: string;

  const codigo = `ACE_4A_${Date.now()}`;

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
    contaId = await criarContaBancaria(app, token, empresaId);

    const body = JSON.stringify(buildAcordoExemploSpec(codigo));
    const resAcordo = await request(app.getHttpServer())
      .post('/v1/integracao/cobranca/acordos')
      .set('Content-Type', 'application/json')
      .set('X-Api-Key', E2E_COB_API_KEY)
      .set('X-Signature', signCobBody(body))
      .send(body);
    expect(resAcordo.status).toBe(201);

    const [{ id }] = await dataSource.query(
      `SELECT p.id FROM pessoas p
       JOIN cobranca_acordos ca ON ca.credor_id = p.id
       WHERE ca.codigo = $1`,
      [codigo],
    );
    credorId = id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('saldo v_saldo_credor e cálculo referência 89,10', async () => {
    const titulos = await dataSource.query(
      `SELECT tr.id FROM titulos_receber tr
       JOIN cobranca_acordos ca ON ca.id = tr.acordo_id
       WHERE ca.codigo = $1 AND tr.parcela_numero = 0`,
      [codigo],
    );
    const tituloId = titulos[0].id as string;

    const baixa = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${tituloId}/baixar`)
      .set(authHeaders(token, empresaId))
      .send({
        conta_bancaria_id: contaId,
        data_baixa: '2026-11-17',
        valor_principal: 100,
        tarifa: 0.9,
        forma: 'PIX',
      });
    expect(baixa.status).toBe(201);
    const baixaRow = baixa.body.baixa as { id: string; valorLiquido?: string; valor_liquido?: string };
    const baixaId = baixaRow.id;
    const liquido = Number(baixaRow.valorLiquido ?? baixaRow.valor_liquido);
    expect(liquido).toBeCloseTo(99.1, 2);

    const saldo = await request(app.getHttpServer())
      .get(`/v1/credores/${credorId}/saldo-repasse`)
      .set(authHeaders(token, empresaId));
    expect(saldo.status).toBe(200);
    expect(Number(saldo.body.recebido_pendente_repasse)).toBeCloseTo(99.1, 2);

    const gerar = await request(app.getHttpServer())
      .post('/v1/repasses/gerar')
      .set(authHeaders(token, empresaId))
      .send({
        credor_id: credorId,
        conta_origem_id: contaId,
        periodo_inicio: '2026-11-01',
        periodo_fim: '2026-11-30',
        percentual_comissao: 10,
        baixa_ids: [baixaId],
      });
    expect(gerar.status).toBe(201);

    const calc = await request(app.getHttpServer())
      .post(`/v1/repasses/${gerar.body.id}/calcular`)
      .set(authHeaders(token, empresaId));
    expect(calc.status).toBe(201);
    const corpo = calc.body as {
      status: string;
      totalRepasse?: string;
      total_repasse?: string;
      itens: Array<{ valorRepasse?: string; valor_repasse?: string; valorRecebido?: string; valor_recebido?: string }>;
    };
    const totalRepasse = Number(corpo.totalRepasse ?? corpo.total_repasse);
    expect(totalRepasse).toBeCloseTo(89.1, 2);
    expect(corpo.status).toBe('CALCULADO');
    expect(corpo.itens).toHaveLength(1);
    const item = corpo.itens[0];
    expect(Number(item.valorRepasse ?? item.valor_repasse)).toBeCloseTo(89.1, 2);
    expect(Number(item.valorRecebido ?? item.valor_recebido)).toBeCloseTo(100, 2);

    const saldoApos = await request(app.getHttpServer())
      .get(`/v1/credores/${credorId}/saldo-repasse`)
      .set(authHeaders(token, empresaId));
    expect(Number(saldoApos.body.recebido_pendente_repasse)).toBe(0);
  });

  it('rejeita baixa já vinculada a repasse calculado', async () => {
    const titulos = await dataSource.query(
      `SELECT tr.id, tr.valor_original FROM titulos_receber tr
       JOIN cobranca_acordos ca ON ca.id = tr.acordo_id
       WHERE ca.codigo = $1 AND tr.parcela_numero = 1`,
      [codigo],
    );
    const baixaP1 = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${titulos[0].id}/baixar`)
      .set(authHeaders(token, empresaId))
      .send({
        conta_bancaria_id: contaId,
        data_baixa: '2026-11-17',
        valor_principal: Number(titulos[0].valor_original),
        forma: 'PIX',
      });
    expect(baixaP1.status).toBe(201);
    const outraBaixa = (baixaP1.body.baixa as { id: string }).id;
    const gerar2 = await request(app.getHttpServer())
      .post('/v1/repasses/gerar')
      .set(authHeaders(token, empresaId))
      .send({
        credor_id: credorId,
        conta_origem_id: contaId,
        periodo_inicio: '2026-11-01',
        periodo_fim: '2026-11-30',
        percentual_comissao: 10,
        baixa_ids: [outraBaixa],
      });
    expect(gerar2.status).toBe(201);

    const calc1 = await request(app.getHttpServer())
      .post(`/v1/repasses/${gerar2.body.id}/calcular`)
      .set(authHeaders(token, empresaId));
    expect(calc1.status).toBe(201);

    const gerarDuplicado = await request(app.getHttpServer())
      .post('/v1/repasses/gerar')
      .set(authHeaders(token, empresaId))
      .send({
        credor_id: credorId,
        conta_origem_id: contaId,
        periodo_inicio: '2026-11-01',
        periodo_fim: '2026-11-30',
        percentual_comissao: 10,
        baixa_ids: [outraBaixa],
      });
    expect(gerarDuplicado.status).toBe(409);
  });
});