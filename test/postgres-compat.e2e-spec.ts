import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('PostgreSQL — compatibilidade (e2e)', () => {
  let dataSource: DataSource;
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('versão >= 15 e índice UNIQUE NULLS NOT DISTINCT em orcamento_item', async () => {
    const [{ version }] = await dataSource.query(`SELECT current_setting('server_version') AS version`);
    const major = Number(String(version).match(/\d+/)?.[0] ?? 0);
    expect(major).toBeGreaterThanOrEqual(15);

    const [idx] = await dataSource.query(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_orc_item_folha'`,
    );
    expect(idx?.indexdef).toMatch(/NULLS NOT DISTINCT/i);
  });
});