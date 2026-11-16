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
import { FormaPagamento } from '../src/database/enums';

describe('titulos-receber (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
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
    ({ token, empresaId } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
    categoriaId = await getCategoriaGlobal(dataSource, '1.01');
    contaId = await criarContaBancaria(app, token, empresaId);
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria título manual, parcela, baixa parcial/total, cancela e filtra', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TR E2E avulso',
        categoria_id: categoriaId,
        valor_original: 1000,
        data_vencimento: '2026-12-01',
      });
    expect(criar.status).toBe(201);
    const tituloId = criar.body.id;

    const parcelar = await request(app.getHttpServer())
      .post('/v1/titulos-receber/parcelar')
      .set(authHeaders(token, empresaId))
      .send({
        categoria_id: categoriaId,
        parcelas: [
          { descricao: 'P1', valor_original: 300, data_vencimento: '2026-12-10' },
          { descricao: 'P2', valor_original: 300, data_vencimento: '2026-01-10' },
        ],
      });
    expect(parcelar.status).toBe(201);
    expect(parcelar.body.titulos).toHaveLength(2);

    const p1 = parcelar.body.titulos[0].id;
    const baixaParcial = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${p1}/baixar`)
      .set(authHeaders(token, empresaId))
      .send({
        conta_bancaria_id: contaId,
        data_baixa: '2026-11-15',
        valor_principal: 150,
        forma: FormaPagamento.PIX,
      });
    expect(baixaParcial.status).toBe(201);
    expect(baixaParcial.body.titulo.status).toBe('PARCIAL');

    const baixaTotal = await request(app.getHttpServer())
      .post(`/v1/titulos-receber/${p1}/baixar`)
      .set(authHeaders(token, empresaId))
      .send({
        conta_bancaria_id: contaId,
        data_baixa: '2026-11-16',
        valor_principal: 150,
        forma: FormaPagamento.PIX,
      });
    expect(baixaTotal.status).toBe(201);
    expect(baixaTotal.body.titulo.status).toBe('PAGO');

    const cancelar = await request(app.getHttpServer())
      .patch(`/v1/titulos-receber/${tituloId}/cancelar`)
      .set(authHeaders(token, empresaId));
    expect(cancelar.status).toBe(200);
    expect(cancelar.body.status).toBe('CANCELADO');

    const lista = await request(app.getHttpServer())
      .get('/v1/titulos-receber')
      .query({ origem: 'MANUAL', status: 'CANCELADO' })
      .set(authHeaders(token, empresaId));
    expect(lista.status).toBe(200);
    expect(lista.body.some((t: { id: string }) => t.id === tituloId)).toBe(true);
  });
});