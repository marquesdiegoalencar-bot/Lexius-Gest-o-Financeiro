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
  try {
    await client.query(sql);
    console.log('schema.sql aplicado com sucesso');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});