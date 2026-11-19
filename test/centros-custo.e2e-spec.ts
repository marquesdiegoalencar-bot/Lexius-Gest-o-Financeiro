import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { authHeaders, E2E_MASTER_EMAIL, E2E_MASTER_SENHA, login } from './e2e-auth.helpers';

describe('centros-custo (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let empresaId: string;

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
    ({ token, empresaId } = await login(app, E2E_MASTER_EMAIL, E2E_MASTER_SENHA));
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria e edita centro de custo entrada', async () => {
    const criar = await request(app.getHttpServer())
      .post('/v1/centros-custo')
      .set(authHeaders(token, empresaId))
      .send({
        codigo: 'CC-E2E-1',
        nome: 'Centro entrada',
        descricao: 'Descrição teste',
        tipo: 'ENTRADA',
      });
    expect(criar.status).toBe(201);
    expect(criar.body.nome).toBe('Centro entrada');

    const editar = await request(app.getHttpServer())
      .patch(`/v1/centros-custo/${criar.body.id}`)
      .set(authHeaders(token, empresaId))
      .send({ descricao: 'Descrição atualizada' });
    expect(editar.status).toBe(200);
    expect(editar.body.descricao).toBe('Descrição atualizada');

    const lista = await request(app.getHttpServer())
      .get('/v1/centros-custo?tipo=ENTRADA')
      .set(authHeaders(token, empresaId));
    expect(lista.status).toBe(200);
    expect(lista.body.some((c: { id: string }) => c.id === criar.body.id)).toBe(true);
  });
});