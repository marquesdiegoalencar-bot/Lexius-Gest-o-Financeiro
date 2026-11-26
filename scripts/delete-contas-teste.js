#!/usr/bin/env node
/**
 * Remove contas bancárias (e lançamentos só vinculados a elas) — uso após testes manuais.
 * Mantém empresas, pessoas e demais cadastros.
 *
 * Uso:
 *   npm run db:delete-contas-teste
 *   npm run db:delete-contas-teste -- --apelido "Inter E2E"
 */
const { Client } = require('pg');

const apelidoFilter = (() => {
  const i = process.argv.indexOf('--apelido');
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return null;
})();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não definida');
    process.exit(1);
  }
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const params = apelidoFilter ? [`%${apelidoFilter}%`] : [];
    const where = apelidoFilter ? 'WHERE apelido ILIKE $1' : '';
    const { rows: contas } = await client.query(
      `SELECT id, apelido FROM contas_bancarias ${where} ORDER BY apelido`,
      params,
    );
    if (!contas.length) {
      console.log('Nenhuma conta bancária encontrada.');
      return;
    }

    await client.query('BEGIN');
    for (const { id, apelido } of contas) {
      const deps = await client.query(
        `
        SELECT (
          EXISTS (SELECT 1 FROM baixas WHERE conta_bancaria_id = $1)
          OR EXISTS (SELECT 1 FROM titulos_receber WHERE conta_bancaria_id = $1)
          OR EXISTS (SELECT 1 FROM titulos_pagar WHERE conta_bancaria_id = $1)
          OR EXISTS (SELECT 1 FROM cobrancas_boleto WHERE conta_bancaria_id = $1)
          OR EXISTS (SELECT 1 FROM cobranca_emissao_pendente WHERE conta_bancaria_id = $1)
          OR EXISTS (SELECT 1 FROM recorrencias WHERE conta_bancaria_id = $1)
          OR EXISTS (SELECT 1 FROM repasses WHERE conta_origem_id = $1)
          OR EXISTS (SELECT 1 FROM pagamentos_bancarios WHERE conta_origem_id = $1 OR conta_destino_id = $1)
        ) AS bloqueado
        `,
        [id],
      );
      if (deps.rows[0]?.bloqueado) {
        console.warn(`Ignorada (títulos/baixas/cobranças): ${apelido}`);
        continue;
      }
      const delMov = await client.query('DELETE FROM movimentos_bancarios WHERE conta_bancaria_id = $1', [id]);
      await client.query('DELETE FROM conta_tarifas_cobranca WHERE conta_bancaria_id = $1', [id]);
      await client.query('DELETE FROM contas_bancarias WHERE id = $1', [id]);
      console.log(`Removida: ${apelido} (movimentos: ${delMov.rowCount ?? 0})`);
    }
    await client.query('COMMIT');
    const rest = await client.query('SELECT COUNT(*)::int AS c FROM contas_bancarias');
    console.log(`contas_bancarias restantes: ${rest.rows[0].c}`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});