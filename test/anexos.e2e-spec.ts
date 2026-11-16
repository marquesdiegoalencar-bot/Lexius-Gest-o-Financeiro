import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as fs from 'fs/promises';
import * as path from 'path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  authHeaders,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SENHA,
  getCategoriaGlobal,
  login,
} from './e2e-auth.helpers';

describe('anexos (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let empresaId: string;
  let tituloId: string;

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
    const categoriaId = await getCategoriaGlobal(dataSource, '1.01');
    const criar = await request(app.getHttpServer())
      .post('/v1/titulos-receber')
      .set(authHeaders(token, empresaId))
      .send({
        descricao: 'TR anexo',
        categoria_id: categoriaId,
        valor_original: 100,
        data_vencimento: '2026-12-01',
      });
    tituloId = criar.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('upload e download com token', async () => {
    const upload = await request(app.getHttpServer())
      .post('/v1/anexos')
      .query({ entidade: 'titulo_receber', entidade_id: tituloId })
      .set(authHeaders(token, empresaId))
      .attach('file', Buffer.from('%PDF-1.4 test'), {
        filename: 'comprovante.pdf',
        contentType: 'application/pdf',
      });
    expect(upload.status).toBe(201);
    expect(upload.body.anexo.nomeArquivo).toBe('comprovante.pdf');
    const storageKey = upload.body.anexo.storageChave as string;
    expect(storageKey).not.toMatch(/comprovante/i);
    expect(storageKey.startsWith(`${empresaId}/`)).toBe(true);
    const nomeDisco = storageKey.split('/').pop() ?? '';
    expect(nomeDisco).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i,
    );
    const storageRoot =
      process.env.STORAGE_LOCAL_PATH ?? path.resolve(process.cwd(), 'storage');
    await fs.access(path.join(storageRoot, storageKey));

    const anexoId = upload.body.anexo.id;
    const dlToken = upload.body.download_token as string;

    const download = await request(app.getHttpServer())
      .get(`/v1/anexos/${anexoId}/download`)
      .query({ token: dlToken })
      .set(authHeaders(token, empresaId));
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toMatch(/pdf/);
  });

  it('rejeita mime não permitido', async () => {
    const upload = await request(app.getHttpServer())
      .post('/v1/anexos')
      .query({ entidade: 'titulo_receber', entidade_id: tituloId })
      .set(authHeaders(token, empresaId))
      .attach('file', Buffer.from('not allowed'), {
        filename: 'x.exe',
        contentType: 'application/octet-stream',
      });
    expect(upload.status).toBe(400);
  });
});