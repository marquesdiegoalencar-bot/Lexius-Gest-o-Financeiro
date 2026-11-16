#!/usr/bin/env node
/**
 * Limpa o schema public e reaplica schema.sql (uso em testes e2e).
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não definida');
    process.exit(1);
  }
  const sqlPath = path.join(__dirname, '..', 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const migrationFiles = fs.existsSync(migrationsDir)
      ? fs
          .readdirSync(migrationsDir)
          .filter((f) => f.endsWith('.sql'))
          .sort()
      : [];

    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await client.query(sql);
    for (const file of migrationFiles) {
      const migSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(migSql);
    }
    console.log('Banco resetado, schema.sql e migrations aplicados');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});