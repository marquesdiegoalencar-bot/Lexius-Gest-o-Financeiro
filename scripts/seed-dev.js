#!/usr/bin/env node
/**
 * Empresa COBRANCA + usuários MASTER e OPERADOR para desenvolvimento local.
 */
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

async function upsertUsuario(client, nome, email, senha) {
  const hash = await bcrypt.hash(senha, 12);
  const force = process.env.SEED_FORCE_PASSWORD === 'true';
  let usuario = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
  if (!usuario.rows.length) {
    usuario = await client.query(
      `INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id`,
      [nome, email, hash],
    );
    console.log('Usuário criado:', email);
  } else if (force) {
    await client.query('UPDATE usuarios SET senha_hash = $1, ativo = true WHERE email = $2', [hash, email]);
    console.log('Senha atualizada (SEED_FORCE_PASSWORD):', email);
  }
  return usuario.rows[0].id;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não definida');
    process.exit(1);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const cnpj = process.env.SEED_EMPRESA_CNPJ || '00000000000191';
    const emailMaster = process.env.SEED_MASTER_EMAIL || 'master@lexius.local';
    const senhaMaster = process.env.SEED_MASTER_SENHA || 'Lexius@123';
    const emailOperador = process.env.SEED_OPERADOR_EMAIL || 'operador@lexius.local';
    const senhaOperador = process.env.SEED_OPERADOR_SENHA || 'Lexius@123';

    let empresa = await client.query('SELECT id FROM empresas WHERE cnpj = $1', [cnpj]);
    if (!empresa.rows.length) {
      empresa = await client.query(
        `INSERT INTO empresas (tipo, razao_social, nome_fantasia, cnpj)
         VALUES ('COBRANCA', 'Lexius Cobrança LTDA', 'Lexius Cobrança', $1)
         RETURNING id`,
        [cnpj],
      );
      console.log('Empresa COBRANCA criada');
    }
    const empresaId = empresa.rows[0].id;

    const masterId = await upsertUsuario(client, 'Master Dev', emailMaster, senhaMaster);
    const operadorId = await upsertUsuario(client, 'Operador Dev', emailOperador, senhaOperador);

    await client.query(
      `INSERT INTO usuario_empresa (usuario_id, empresa_id, papel)
       VALUES ($1, $2, 'MASTER')
       ON CONFLICT DO NOTHING`,
      [masterId, empresaId],
    );

    await client.query(
      `INSERT INTO usuario_empresa (usuario_id, empresa_id, papel)
       VALUES ($1, $2, 'OPERADOR')
       ON CONFLICT DO NOTHING`,
      [operadorId, empresaId],
    );

    const conta = await client.query(
      `SELECT id FROM contas_bancarias WHERE empresa_id = $1 AND banco_codigo = '077' LIMIT 1`,
      [empresaId],
    );
    if (!conta.rows.length) {
      await client.query(
        `INSERT INTO contas_bancarias (
          empresa_id, apelido, banco_codigo, agencia, conta, provedor, credencial_ref, chave_pix, tipo_chave_pix, sincroniza_extrato
        ) VALUES ($1, 'Inter COB E2E', '077', '0001', '77701', 'INTER', 'e2e', 'e2e-chave-pix@test.local', 'EMAIL', true)
        ON CONFLICT DO NOTHING`,
        [empresaId],
      );
      console.log('Conta Inter COB (chave_pix) criada para emissão Pix');
    }

    console.log('Vínculos OK. empresa_id=', empresaId);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});