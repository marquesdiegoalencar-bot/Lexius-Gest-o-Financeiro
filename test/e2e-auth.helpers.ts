import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

export const E2E_MASTER_EMAIL = 'master@lexius.local';
export const E2E_MASTER_SENHA = 'Lexius@123';
export const E2E_OPERADOR_EMAIL = 'operador@lexius.local';
export const E2E_OPERADOR_SENHA = 'Lexius@123';

export async function login(
  app: INestApplication,
  email: string,
  senha: string,
): Promise<{ token: string; empresaId: string }> {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ email, senha });
  expect(res.status).toBe(201);
  const empresaId = res.body.usuario.empresas[0].empresa_id as string;
  return { token: res.body.access_token as string, empresaId };
}

export async function getCategoriaGlobal(
  dataSource: DataSource,
  codigo: string,
): Promise<string> {
  const [{ id }] = await dataSource.query(`SELECT id FROM categorias WHERE codigo = $1 LIMIT 1`, [
    codigo,
  ]);
  return id;
}

export function authHeaders(token: string, empresaId: string) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Empresa-Id': empresaId,
  };
}

export async function criarContaBancaria(
  app: INestApplication,
  token: string,
  empresaId: string,
) {
  const sufixo = `${Date.now()}`.slice(-5);
  const res = await request(app.getHttpServer())
    .post('/v1/contas-bancarias')
    .set(authHeaders(token, empresaId))
    .send({
      apelido: `Conta E2E ${sufixo}`,
      banco_codigo: '001',
      agencia: '0001',
      conta: sufixo,
    });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

export async function saldoSistemaConta(
  dataSource: DataSource,
  contaId: string,
): Promise<number> {
  const [row] = await dataSource.query(
    `SELECT saldo_sistema FROM v_saldo_conta WHERE conta_bancaria_id = $1`,
    [contaId],
  );
  return Number(row?.saldo_sistema ?? 0);
}

export async function posicaoEmpresa(dataSource: DataSource, empresaId: string) {
  const [row] = await dataSource.query(
    `SELECT saldo_total_contas, a_repassar_credores, saldo_proprio
     FROM v_posicao_empresa WHERE empresa_id = $1`,
    [empresaId],
  );
  return {
    saldoTotal: Number(row?.saldo_total_contas ?? 0),
    aRepassar: Number(row?.a_repassar_credores ?? 0),
    saldoProprio: Number(row?.saldo_proprio ?? 0),
  };
}

export async function somaSaldoContasEmpresa(
  dataSource: DataSource,
  empresaId: string,
): Promise<number> {
  const [row] = await dataSource.query(
    `SELECT COALESCE(SUM(saldo_sistema), 0)::float AS total
     FROM v_saldo_conta WHERE empresa_id = $1`,
    [empresaId],
  );
  return Number(row?.total ?? 0);
}