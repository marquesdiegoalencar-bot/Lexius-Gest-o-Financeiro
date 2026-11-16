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

describe('titulos-pagar (e2e)', () => {
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
    categoriaId = await getCategoriaGlobal(dataSource, '2.01');
    contaId = await criarContaBancaria(app, masterToken, empresaId);
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria TP, operador não baixa, master aprova e baixa', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-pagar')
      .set(authHeaders(operadorToken, empresaId))
      .send({
        descricao: 'TP E2E',
        categoria_id: categoriaId,
        valor_original: 500,
        data_vencimento: '2026-12-05',
      });
    expect(criar.status).toBe(201);
    const tituloId = criar.body.id;

    const baixaOperador = await request(app.getHttpServer())
      .post(`/v1/titulos-pagar/${tituloId}/baixar`)
      .set(authHeaders(operadorToken, empresaId))
      .send({
        conta_bancaria_id: contaId,
        data_baixa: '2026-11-15',
        valor_principal: 500,
        forma: FormaPagamento.PIX,
      });
    expect(baixaOperador.status).toBe(403);

    const aprovar = await request(app.getHttpServer())
      .post(`/v1/titulos-pagar/${tituloId}/aprovar`)
      .set(authHeaders(masterToken, empresaId));
    expect(aprovar.status).toBe(201);
    expect(aprovar.body.statusAprovacao).toBe('APROVADO');

    const baixaMaster = await request(app.getHttpServer())
      .post(`/v1/titulos-pagar/${tituloId}/baixar`)
      .set(authHeaders(masterToken, empresaId))
      .send({
        conta_bancaria_id: contaId,
        data_baixa: '2026-11-15',
        valor_principal: 500,
        forma: FormaPagamento.PIX,
      });
    expect(baixaMaster.status).toBe(201);
    expect(baixaMaster.body.titulo.status).toBe('PAGO');
  });
});