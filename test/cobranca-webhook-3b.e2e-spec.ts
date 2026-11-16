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
  getCategoriaGlobal,
  login,
} from './e2e-auth.helpers';

describe('Fase 3B — cobrança, webhook e baixa automática (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let empresaId: string;
  let contaId: string;
  let catReceita: string;

  const webhookHeaders = () => ({
    'X-Inter-Mock-Secret': process.env.WEBHOOK_INTER_MOCK_SECRET ?? 'e2e-webhook-inter-secret',
  });

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
    catReceita = await getCategoriaGlobal(dataSource, '1.01');

    const criar = await request(app.getHttpServer())
      .post('/v1/contas-bancarias')
      .set(authHeaders(token, empresaId))
      .send({
        apelido: 'Inter cobrança E2E',
        banco_codigo: '077',
        agencia: '0001',
        conta: '77701',
        provedor: 'INTER',
        credencial_ref: 'e2e',
      });
    contaId = criar.body.id;

    await request(app.getHttpServer())
      .post(`/v1/contas-bancarias/${contaId}/tarifas-cobranca`)
      .set(authHeaders(token, empresaId))
      .send({ forma: 'PIX', valor_tarifa: 3.5 });
  });

  afterAll(async () => {
    await app.close();
  });

  async function criarTitulo(valor: number) {
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TR cobrança 3B',
        categoria_id: catReceita,
        valor_original: valor,
        data_vencimento: '2026-12-20',
        conta_bancaria_id: contaId,
      });
    return criar.body.id as string;
  }

  it('emite cobrança, webhook dispara verificação GET e baixa com tarifa', async () => {
    const tituloId = await criarTitulo(200);
    const emitir = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${tituloId}/emitir-boleto`)
      .set(authHeaders(token, empresaId))
      .send({ conta_bancaria_id: contaId });
    expect(emitir.status).toBe(201);
    const cobrancaId = emitir.body.cobranca.id;
    const codigo = emitir.body.cobranca.idExterno as string;

    await request(app.getHttpServer())
      .post(`/v1/cobrancas-boleto/${cobrancaId}/simular-pagamento-mock`)
      .set(authHeaders(token, empresaId))
      .send({ valor_total_recebido: 200, juros: 5, desconto: 2 });

    await new Promise((r) => setTimeout(r, 200));

    const wh = await request(app.getHttpServer())
      .post('/v1/webhooks/inter')
      .set(webhookHeaders())
      .send({ codigoSolicitacao: codigo, situacao: 'RECEBIDO' });
    expect(wh.status).toBe(201);

    await new Promise((r) => setTimeout(r, 400));

    const titulo = await dataSource.query(
      `SELECT status, valor_recebido::float FROM titulos_receber WHERE id = $1`,
      [tituloId],
    );
    expect(titulo[0].status).toBe('PAGO');
    expect(titulo[0].valor_recebido).toBeCloseTo(200, 2);

    const movs = await dataSource.query(
      `SELECT tipo_transacao, valor::float, origem FROM movimentos_bancarios
       WHERE conta_bancaria_id = $1 AND tipo_transacao IN ('BAIXA','TARIFA')
       ORDER BY tipo_transacao`,
      [contaId],
    );
    expect(movs.find((m: { tipo_transacao: string }) => m.tipo_transacao === 'BAIXA')?.valor).toBe(
      200,
    );
    expect(movs.find((m: { tipo_transacao: string }) => m.tipo_transacao === 'TARIFA')?.valor).toBe(
      3.5,
    );
    expect(movs[0].origem).toBe('API_BANCO');
  });

  it('baixa parcial quando valor pago é menor que o nominal', async () => {
    const tituloId = await criarTitulo(300);
    const emitir = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${tituloId}/emitir-boleto`)
      .set(authHeaders(token, empresaId));
    const cobrancaId = emitir.body.cobranca.id;
    const codigo = emitir.body.cobranca.idExterno as string;

    await request(app.getHttpServer())
      .post(`/v1/cobrancas-boleto/${cobrancaId}/simular-pagamento-mock`)
      .set(authHeaders(token, empresaId))
      .send({ valor_total_recebido: 150 });

    await request(app.getHttpServer())
      .post('/v1/webhooks/inter')
      .set(webhookHeaders())
      .send({ codigoSolicitacao: codigo });

    await new Promise((r) => setTimeout(r, 400));

    const titulo = await dataSource.query(
      `SELECT status, valor_recebido::float FROM titulos_receber WHERE id = $1`,
      [tituloId],
    );
    expect(titulo[0].status).toBe('PARCIAL');
    expect(titulo[0].valor_recebido).toBeCloseTo(150, 2);
  });

  it('webhook duplicado e payload sem codigo não geram segunda baixa', async () => {
    const tituloId = await criarTitulo(80);
    const emitir = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${tituloId}/emitir-boleto`)
      .set(authHeaders(token, empresaId));
    const codigo = emitir.body.cobranca.idExterno as string;
    await request(app.getHttpServer())
      .post(`/v1/cobrancas-boleto/${emitir.body.cobranca.id}/simular-pagamento-mock`)
      .set(authHeaders(token, empresaId))
      .send({ valor_total_recebido: 80 });

    const wh1 = await request(app.getHttpServer())
      .post('/v1/webhooks/inter')
      .set(webhookHeaders())
      .send({ codigoSolicitacao: codigo });
    const wh2 = await request(app.getHttpServer())
      .post('/v1/webhooks/inter')
      .set(webhookHeaders())
      .send({ codigoSolicitacao: codigo });
    expect(wh2.body.duplicado).toBe(true);

    await new Promise((r) => setTimeout(r, 400));

    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM baixas WHERE titulo_receber_id = $1 AND estornada = false`,
      [tituloId],
    );
    expect(count).toBe(1);

    const desconhecido = await request(app.getHttpServer())
      .post('/v1/webhooks/inter')
      .set(webhookHeaders())
      .send({ foo: 'bar' });
    expect(desconhecido.body.revisao_manual).toBe(true);
    const eventos = await dataSource.query(
      `SELECT revisao_manual FROM webhook_eventos WHERE tipo_evento = 'COBRANCA_DESCONHECIDO'`,
    );
    expect(eventos.some((e: { revisao_manual: boolean }) => e.revisao_manual)).toBe(true);
  });

  it('rejeita webhook sem segredo no mock', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/webhooks/inter')
      .send({ codigoSolicitacao: 'x' });
    expect(res.status).toBe(401);
  });
});