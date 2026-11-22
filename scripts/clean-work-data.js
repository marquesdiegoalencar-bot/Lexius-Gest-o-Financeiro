#!/usr/bin/env node
/**
 * Remove lançamentos e cadastros de teste (e2e/manual), preservando seed de login e categorias globais.
 * Uso: npm run db:clean-work
 * Slate total (--slate): remove TODAS empresas e contas; categorias globais e usuários permanecem.
 */
const { Client } = require('pg');

const SEED_CNPJ = (process.env.SEED_EMPRESA_CNPJ || process.env.COB_EMPRESA_CNPJ || '00000000000191').replace(
  /\D/g,
  '',
);

/** Tabelas transacionais (ordem: dependentes primeiro). */
const TX_TABLES = [
  'cob_retorno_eventos',
  'webhook_eventos',
  'cobranca_emissao_pendente',
  'cobrancas_boleto',
  'conta_tarifas_cobranca',
  'repasse_itens',
  'repasses',
  'baixa_alocacao_item',
  'baixas',
  'titulo_rateio_vigencia_item',
  'titulo_rateio_vigencia',
  'titulo_alocacao_item',
  'titulo_alocacao_definicao',
  'movimentos_bancarios',
  'pagamentos_bancarios',
  'operacoes_intergrupo',
  'titulos_receber',
  'titulos_pagar',
  'recorrencias',
  'cobranca_acordos',
  'orcamento_item',
  'orcamento_versao',
  'anexos',
  'conciliacoes',
  'fechamentos',
  'auditoria',
  'pessoa_dados_bancarios',
  'credor_regras_repasse',
  'pessoas',
  'departamentos',
  'centros_custo',
  'contas_bancarias',
];

const slateTotal = process.argv.includes('--slate');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não definida');
    process.exit(1);
  }
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query('BEGIN');

    const mig = await client.query(
      `SELECT to_regclass('public.lexius_mig_vigencia_fuso_aprovacao') IS NOT NULL AS ok`,
    );
    if (mig.rows[0]?.ok) {
      await client.query('TRUNCATE lexius_mig_vigencia_fuso_aprovacao');
      console.log('Trilha de migração vigência (aprovações) limpa.');
    }

    const existing = [];
    for (const table of TX_TABLES) {
      const reg = await client.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`public.${table}`]);
      if (reg.rows[0]?.ok) existing.push(table);
    }
    if (existing.length) {
      await client.query(`TRUNCATE TABLE ${existing.join(', ')} RESTART IDENTITY CASCADE`);
      console.log('Transacionais truncadas:', existing.length, 'tabelas');
    }

    if (slateTotal) {
      const delCat = await client.query('DELETE FROM categorias WHERE empresa_id IS NOT NULL');
      console.log(`categorias (por empresa): ${delCat.rowCount ?? 0} removida(s)`);
      await client.query('DELETE FROM usuario_empresa');
      const delEmpresas = await client.query('DELETE FROM empresas');
      console.log(`empresas: ${delEmpresas.rowCount ?? 0} removida(s) (nenhuma mantida)`);
      const contas = await client.query('SELECT COUNT(*)::int AS c FROM contas_bancarias');
      console.log(`contas_bancarias restantes: ${contas.rows[0]?.c ?? 0}`);
    } else {
      await client.query(
        `DELETE FROM usuario_empresa
         WHERE empresa_id IN (SELECT id FROM empresas WHERE cnpj <> $1)`,
        [SEED_CNPJ],
      );

      const delEmpresas = await client.query(`DELETE FROM empresas WHERE cnpj <> $1`, [SEED_CNPJ]);
      console.log(`empresas (teste): ${delEmpresas.rowCount ?? 0} removida(s)`);

      const seed = await client.query('SELECT id, razao_social FROM empresas WHERE cnpj = $1', [SEED_CNPJ]);
      if (!seed.rows.length) {
        console.warn('Empresa seed não encontrada; rode npm run db:seed:dev após o clean.');
      } else {
        console.log('Empresa mantida:', seed.rows[0].razao_social, `(${SEED_CNPJ})`);
      }
    }

    await client.query('COMMIT');
    if (slateTotal) {
      console.log('Sistema limpo. Rode: npm run db:seed:dev');
    } else {
      console.log('Banco pronto para trabalho real (estrutura e categorias globais preservadas).');
    }
    console.log('Login dev:', process.env.SEED_MASTER_EMAIL || 'master@lexius.local');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});