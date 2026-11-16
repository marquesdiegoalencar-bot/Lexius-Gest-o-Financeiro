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