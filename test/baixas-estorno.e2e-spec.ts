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
  E2E_OPERADOR_EMAIL,
  E2E_OPERADOR_SENHA,
  getCategoriaGlobal,
  login,
} from './e2e-auth.helpers';

describe('baixas estorno (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let masterToken: string;
  let operadorToken: string;
  let empresaId: string;
  let categoriaId: string;
  let contaId: string;

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
    ({ token: masterToken, empresaId } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
    ({ token: operadorToken } = await login(app, E2E_OPERADOR_EMAIL, E2E_OPERADOR_SENHA));
    categoriaId = await getCategoriaGlobal(dataSource, '1.01');
    contaId = await criarContaBancaria(app, masterToken, empresaId);
  });

  afterAll(async () => {
    await app.close();
  });

  it('MASTER estorna, operador 403, grava auditoria', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(masterToken, empresaId))
      .send({
        descricao: 'TR estorno',
        categoria_id: categoriaId,
        valor_original: 200,
        data_vencimento: '2026-12-01',
      });
    const tituloId = criar.body.id;

    const baixa = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${tituloId}/baixar`)
      .set(authHeaders(masterToken, empresaId))
      .send({
        conta_bancaria_id: contaId,
        data_baixa: '2026-11-15',
        valor_principal: 200,
        forma: FormaPagamento.PIX,
      });
    const baixaId = baixa.body.baixa.id;

    const estornoOperador = await request(app.getHttpServer())
      .post(`/v1/baixas/${baixaId}/estornar`)
      .set(authHeaders(operadorToken, empresaId))
      .send({ motivo: 'tentativa operador' });
    expect(estornoOperador.status).toBe(403);

    const estorno = await request(app.getHttpServer())
      .post(`/v1/baixas/${baixaId}/estornar`)
      .set(authHeaders(masterToken, empresaId))
      .send({ motivo: 'erro de lançamento' });
    expect(estorno.status).toBe(201);
    expect(estorno.body.estornada).toBe(true);

    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM auditoria WHERE entidade = 'baixa' AND entidade_id = $1 AND acao = 'ESTORNAR'`,
      [baixaId],
    );
    expect(count).toBeGreaterThanOrEqual(1);
  });
});