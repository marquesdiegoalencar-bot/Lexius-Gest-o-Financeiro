import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  authHeaders,
  E2E_MASTER_EMAIL,
  E2E_MASTER_SENHA,
  login,
} from './e2e-auth.helpers';

describe('migration 013 — D.1 integridade (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let masterToken: string;
  let masterEmpresaId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('v1');
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    const colsTr = await dataSource.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'titulos_receber'
       AND column_name IN ('departamento_id', 'centro_custo_id')`,
    );
    expect(colsTr.map((r: { column_name: string }) => r.column_name).sort()).toEqual([
      'centro_custo_id',
      'departamento_id',
    ]);

    const fks = await dataSource.query(
      `SELECT conname FROM pg_constraint
       WHERE conname IN (
         'titulos_receber_departamento_mesma_empresa_fkey',
         'titulos_receber_centro_mesma_empresa_fkey',
         'titulos_pagar_departamento_mesma_empresa_fkey',
         'titulos_pagar_centro_mesma_empresa_fkey',
         'recorrencias_departamento_mesma_empresa_fkey',
         'recorrencias_centro_mesma_empresa_fkey'
       )`,
    );
    expect(fks.length).toBe(6);

    ({ token: masterToken, empresaId: masterEmpresaId } = await login(
      app,
      E2E_MASTER_EMAIL,
      E2E_MASTER_SENHA,
    ));
  });

  afterAll(async () => {
    await app.close();
  });

  it('títulos legados sem departamento_id permanecem válidos', async () => {
    const [row] = await dataSource.query(
      `SELECT id, departamento_id, centro_custo_id FROM titulos_receber
       WHERE empresa_id = $1 LIMIT 1`,
      [masterEmpresaId],
    );
    if (row) {
      expect(row.departamento_id).toBeNull();
    }
  });

  it('FK composta rejeita departamento_id de outra empresa no título', async () => {
    const [depOutra] = await dataSource.query(
      `INSERT INTO empresas (tipo, razao_social, nome_fantasia, cnpj)
       VALUES ('OUTRA', 'E2E FK Dep', 'FK', '77777777000177')
       RETURNING id`,
    );
    const [dep] = await dataSource.query(
      `INSERT INTO departamentos (empresa_id, nome) VALUES ($1, 'Dept FK') RETURNING id`,
      [depOutra.id],
    );
    const [cat] = await dataSource.query(
      `SELECT id FROM categorias WHERE codigo = '1.01' AND empresa_id IS NULL LIMIT 1`,
    );

    await expect(
      dataSource.query(
        `INSERT INTO titulos_receber (
          empresa_id, descricao, categoria_id, valor_original, data_vencimento, departamento_id
        ) VALUES ($1, 'FK cross', $2, 10, '2030-01-01', $3)`,
        [masterEmpresaId, cat.id, dep.id],
      ),
    ).rejects.toThrow();
  });

  it('FK composta rejeita centro_custo_id de outra empresa no título', async () => {
    const [empOutra] = await dataSource.query(
      `INSERT INTO empresas (tipo, razao_social, nome_fantasia, cnpj)
       VALUES ('OUTRA', 'E2E FK CC', 'FK2', '66666666000166')
       RETURNING id`,
    );
    const [cc] = await dataSource.query(
      `INSERT INTO centros_custo (empresa_id, nome, tipo_no) VALUES ($1, 'CC FK', 'ANALITICO') RETURNING id`,
      [empOutra.id],
    );
    const [cat] = await dataSource.query(
      `SELECT id FROM categorias WHERE codigo = '1.01' AND empresa_id IS NULL LIMIT 1`,
    );

    await expect(
      dataSource.query(
        `INSERT INTO titulos_receber (
          empresa_id, descricao, categoria_id, valor_original, data_vencimento, centro_custo_id
        ) VALUES ($1, 'FK CC cross', $2, 10, '2030-01-01', $3)`,
        [masterEmpresaId, cat.id, cc.id],
      ),
    ).rejects.toThrow();
  });

  it('vínculo válido na mesma empresa é aceito via SQL direto', async () => {
    const [dep] = await dataSource.query(
      `INSERT INTO departamentos (empresa_id, nome) VALUES ($1, 'Dept OK') RETURNING id`,
      [masterEmpresaId],
    );
    const [cat] = await dataSource.query(
      `SELECT id FROM categorias WHERE codigo = '1.01' AND empresa_id IS NULL LIMIT 1`,
    );
    const [ins] = await dataSource.query(
      `INSERT INTO titulos_receber (
        empresa_id, descricao, categoria_id, valor_original, data_vencimento, departamento_id
      ) VALUES ($1, 'FK OK', $2, 15, '2030-02-01', $3)
      RETURNING id, departamento_id`,
      [masterEmpresaId, cat.id, dep.id],
    );
    expect(ins.departamento_id).toBe(dep.id);
  });
});