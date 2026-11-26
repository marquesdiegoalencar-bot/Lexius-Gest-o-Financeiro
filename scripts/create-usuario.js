#!/usr/bin/env node
/**
 * Cria ou atualiza usuário (senha bcrypt) e vincula como MASTER às empresas existentes.
 * Uso: ADMIN_EMAIL=... ADMIN_SENHA=... [ADMIN_NOME=...] npm run db:create-usuario
 * Não commitar senhas — só variáveis de ambiente.
 */
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const senha = process.env.ADMIN_SENHA || '';
  const nome = (process.env.ADMIN_NOME || email.split('@')[0] || 'Administrador').trim();

  if (!url) {
    console.error('DATABASE_URL não definida');
    process.exit(1);
  }
  if (!email || !senha) {
    console.error('Defina ADMIN_EMAIL e ADMIN_SENHA');
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const hash = await bcrypt.hash(senha, 12);
    let row = await client.query('SELECT id FROM usuarios WHERE lower(email) = $1', [email]);

    let userId;
    if (!row.rows.length) {
      const ins = await client.query(
        `INSERT INTO usuarios (nome, email, senha_hash, ativo) VALUES ($1, $2, $3, true) RETURNING id`,
        [nome, email, hash],
      );
      userId = ins.rows[0].id;
      console.log('Usuário criado:', email);
    } else {
      userId = row.rows[0].id;
      await client.query(
        'UPDATE usuarios SET nome = $1, senha_hash = $2, ativo = true WHERE id = $3',
        [nome, hash, userId],
      );
      console.log('Usuário atualizado:', email);
    }

    let empresas = await client.query('SELECT id, razao_social FROM empresas ORDER BY razao_social');
    if (!empresas.rows.length) {
      const cnpj = (process.env.SEED_EMPRESA_CNPJ || '00000000000191').replace(/\D/g, '');
      const ins = await client.query(
        `INSERT INTO empresas (tipo, razao_social, nome_fantasia, cnpj)
         VALUES ('COBRANCA', 'Lexius Financeiro', 'Lexius Financeiro', $1) RETURNING id, razao_social`,
        [cnpj],
      );
      empresas = { rows: ins.rows };
      console.log('Empresa padrão criada');
    }

    for (const e of empresas.rows) {
      await client.query(
        `INSERT INTO usuario_empresa (usuario_id, empresa_id, papel)
         VALUES ($1, $2, 'MASTER')
         ON CONFLICT (usuario_id, empresa_id) DO UPDATE SET papel = EXCLUDED.papel`,
        [userId, e.id],
      );
      console.log('Vínculo MASTER:', e.razao_social);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});