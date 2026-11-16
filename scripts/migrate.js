#!/usr/bin/env node
/**
 * Aplica schema.sql ao banco indicado por DATABASE_URL.
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
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const migrationFiles = fs.existsSync(migrationsDir)
    ? fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort()
    : [];

  try {
    await client.query(sql);
    console.log('schema.sql aplicado com sucesso');
    for (const file of migrationFiles) {
      const migSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(migSql);
      console.log(`migration aplicada: ${file}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});