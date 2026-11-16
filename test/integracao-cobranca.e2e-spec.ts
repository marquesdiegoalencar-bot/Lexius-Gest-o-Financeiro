import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  buildAcordoExemploSpec,
  E2E_COB_API_KEY,
  signCobBody,
} from './cob-integracao.helpers';

describe('POST /v1/integracao/cobranca/acordos (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const codigo = `ACE_E2E_${Date.now()}`;
  let bodyValido: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
    bodyValido = JSON.stringify(buildAcordoExemploSpec(codigo));
  });

  afterAll(async () => {
    await app.close();
  });

  function postAcordo(rawBody: string, signature: string) {
    return request(app.getHttpServer())
      .post('/v1/integracao/cobranca/acordos')
      .set('Content-Type', 'application/json')
      .set('X-Api-Key', E2E_COB_API_KEY)
      .set('X-Signature', signature)
      .send(rawBody);
  }

  it('cria acordo com 5 títulos (HTTP 201)', async () => {
    const res = await postAcordo(bodyValido, signCobBody(bodyValido));
    expect(res.status).toBe(201);
    expect(res.body.idempotente).toBe(false);
    expect(res.body.titulos).toHaveLength(5);
    expect(res.body.emissoes_pix?.length).toBe(5);
    const falhas = (res.body.emissoes_pix as Array<{ erro?: string; titulo_id: string }>)?.filter(
      (e) => !(e as { cobranca_id?: string }).cobranca_id,
    );
    expect(falhas).toEqual([]);

    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM titulos_receber WHERE cobranca_acordo_id = $1`,
      [codigo],
    );
    expect(count).toBe(5);
  });

  it('repetição idempotente retorna HTTP 200 sem duplicar', async () => {
    const res = await postAcordo(bodyValido, signCobBody(bodyValido));
    expect(res.status).toBe(200);
    expect(res.body.idempotente).toBe(true);
    expect(res.body.titulos).toHaveLength(5);

    const [{ titulos, acordos }] = await dataSource.query(
      `SELECT
         (SELECT count(*)::int FROM titulos_receber WHERE cobranca_acordo_id = $1) AS titulos,
         (SELECT count(*)::int FROM cobranca_acordos WHERE codigo = $1) AS acordos`,
      [codigo],
    );
    expect(titulos).toBe(5);
    expect(acordos).toBe(1);
  });

  it('rejeita assinatura HMAC inválida (HTTP 401)', async () => {
    const res = await postAcordo(bodyValido, '0'.repeat(64));
    expect(res.status).toBe(401);
  });

  it('rejeita acordo com valores que não batem (HTTP 400)', async () => {
    const invalido = buildAcordoExemploSpec(`ACE_INVALIDO_${Date.now()}`);
    invalido.valor_acordado = 900;
    const raw = JSON.stringify(invalido);
    const res = await postAcordo(raw, signCobBody(raw));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/parcelas|valor_acordado/i);
  });
});