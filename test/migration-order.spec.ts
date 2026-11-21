/**
 * Ordem real de migrations/*.sql — mesma lógica de migrate.js / reset-db.js.
 */
import fs from 'fs';
import path from 'path';

function listMigrationSql(): string[] {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

describe('ordem migrations SQL (migrate.js / reset-db.js)', () => {
  it('019 → 019a → 020 → 021 na lista sorted', () => {
    const files = listMigrationSql();
    const i019 = files.indexOf('019_vigencia_fuso_aprovacao_estrutura.sql');
    const i019a = files.indexOf('019a_vigencia_fuso_aprovacao_trilha.sql');
    const i020 = files.indexOf('020_corretiva_vigencia_legado_fuso_exec.sql');
    const i021 = files.indexOf('021_corretiva_vigencia_legado_fuso_idempotente.sql');
    expect(i019).toBeGreaterThanOrEqual(0);
    expect(i019a).toBe(i019 + 1);
    expect(i020).toBe(i019a + 1);
    expect(i021).toBe(i020 + 1);
  });

  it('espelha readdir+sort dos scripts Node', () => {
    const fromHelper = listMigrationSql();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fromNode = require('fs')
      .readdirSync(path.join(__dirname, '..', 'migrations'))
      .filter((f: string) => f.endsWith('.sql'))
      .sort();
    expect(fromHelper).toEqual(fromNode);
  });
});