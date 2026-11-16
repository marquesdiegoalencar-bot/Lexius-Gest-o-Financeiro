#!/usr/bin/env node
/**
 * Empresa COBRANCA + usuário MASTER para desenvolvimento local.
 */
const bcrypt = require('bcrypt');
const { Client } = require('pg');

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
    const email = process.env.SEED_MASTER_EMAIL || 'master@lexius.local';
    const senha = process.env.SEED_MASTER_SENHA || 'Lexius@123';

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

    const hash = await bcrypt.hash(senha, 12);
    let usuario = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (!usuario.rows.length) {
      usuario = await client.query(
        `INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id`,
        ['Master Dev', email, hash],
      );
      console.log('Usuário MASTER criado:', email);
    }
    const usuarioId = usuario.rows[0].id;

    await client.query(
      `INSERT INTO usuario_empresa (usuario_id, empresa_id, papel)
       VALUES ($1, $2, 'MASTER')
       ON CONFLICT DO NOTHING`,
      [usuarioId, empresaId],
    );
    console.log('Vínculo MASTER OK. empresa_id=', empresaId);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});