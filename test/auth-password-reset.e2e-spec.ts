import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { E2E_MASTER_EMAIL, E2E_MASTER_SENHA } from './e2e-auth.helpers';

describe('auth password reset (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const novaSenha = 'NovaSenha@456';

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

    const tables = await dataSource.query(
      `SELECT to_regclass('public.senha_reset_tokens') AS reg`,
    );
    expect(tables[0]?.reg).toBe('senha_reset_tokens');
  });

  afterAll(async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/esqueci-senha')
      .send({ email: E2E_MASTER_EMAIL });
    const forgot = await request(app.getHttpServer())
      .post('/v1/auth/esqueci-senha')
      .send({ email: E2E_MASTER_EMAIL });
    const token = forgot.body.reset_token as string;
    if (token) {
      await request(app.getHttpServer())
        .post('/v1/auth/redefinir-senha')
        .send({ token, nova_senha: E2E_MASTER_SENHA });
    }
    await app.close();
  });

  it('esqueci-senha não revela se o e-mail existe (resposta genérica)', async () => {
    const desconhecido = await request(app.getHttpServer())
      .post('/v1/auth/esqueci-senha')
      .send({ email: 'nao-existe@lexius.local' });
    expect(desconhecido.status).toBe(201);
    expect(String(desconhecido.body.message)).toContain('Se o e-mail');

    const conhecido = await request(app.getHttpServer())
      .post('/v1/auth/esqueci-senha')
      .send({ email: E2E_MASTER_EMAIL });
    expect(conhecido.status).toBe(201);
    expect(String(conhecido.body.message)).toContain('Se o e-mail');
    expect(conhecido.body.reset_token).toBeTruthy();
  });

  it('redefinir-senha e login com nova senha', async () => {
    const forgot = await request(app.getHttpServer())
      .post('/v1/auth/esqueci-senha')
      .send({ email: E2E_MASTER_EMAIL });
    const token = forgot.body.reset_token as string;
    expect(token).toBeTruthy();

    const bad = await request(app.getHttpServer())
      .post('/v1/auth/redefinir-senha')
      .send({ token, nova_senha: 'curta' });
    expect(bad.status).toBe(400);

    const ok = await request(app.getHttpServer())
      .post('/v1/auth/redefinir-senha')
      .send({ token, nova_senha: novaSenha });
    expect(ok.status).toBe(201);

    const oldLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: E2E_MASTER_EMAIL, senha: E2E_MASTER_SENHA });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: E2E_MASTER_EMAIL, senha: novaSenha });
    expect(newLogin.status).toBe(201);

    const reuse = await request(app.getHttpServer())
      .post('/v1/auth/redefinir-senha')
      .send({ token, nova_senha: 'OutraSenha@999' });
    expect(reuse.status).toBe(400);
  });
});