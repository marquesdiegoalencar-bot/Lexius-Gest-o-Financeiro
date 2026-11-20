import { readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';

export const MIG019_ESTRUTURA = readFileSync(
  join(__dirname, '..', 'migrations', '019_vigencia_fuso_aprovacao_estrutura.sql'),
  'utf8',
);
export const MIG020_EXEC = readFileSync(
  join(__dirname, '..', 'migrations', '020_corretiva_vigencia_legado_fuso_exec.sql'),
  'utf8',
);

const SNAPSHOT_INSERT_ONE = `
INSERT INTO lexius_mig_vigencia_fuso_aprovacao (
  vigencia_id,
  empresa_id_aprovado,
  origem_aprovada,
  fuso_negocio_aprovado,
  valido_de_aprovado,
  valido_ate_aprovado,
  novo_valido_de_aprovado,
  novo_valido_ate_aprovado
)
SELECT
  v.id,
  v.empresa_id,
  v.origem,
  COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus'),
  v.valido_de,
  v.valido_ate,
  (
    ((v.valido_de AT TIME ZONE '-04')::date)::timestamp
    AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus')
  )::timestamptz,
  CASE
    WHEN v.valido_ate IS NULL THEN NULL
    ELSE (
      ((v.valido_ate AT TIME ZONE '-04')::date)::timestamp
      AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus')
    )::timestamptz
  END
FROM titulo_rateio_vigencia v
INNER JOIN empresas e ON e.id = v.empresa_id
WHERE v.id = $1
ON CONFLICT (vigencia_id) DO UPDATE SET
  empresa_id_aprovado = EXCLUDED.empresa_id_aprovado,
  origem_aprovada = EXCLUDED.origem_aprovada,
  fuso_negocio_aprovado = EXCLUDED.fuso_negocio_aprovado,
  valido_de_aprovado = EXCLUDED.valido_de_aprovado,
  valido_ate_aprovado = EXCLUDED.valido_ate_aprovado,
  novo_valido_de_aprovado = EXCLUDED.novo_valido_de_aprovado,
  novo_valido_ate_aprovado = EXCLUDED.novo_valido_ate_aprovado`;

export async function inserirAprovacaoVigencia(dataSource: DataSource, vigenciaId: string): Promise<void> {
  await dataSource.query(SNAPSHOT_INSERT_ONE, [vigenciaId]);
}

export async function inserirAprovacaoTodosElegiveis(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    INSERT INTO lexius_mig_vigencia_fuso_aprovacao (
      vigencia_id,
      empresa_id_aprovado,
      origem_aprovada,
      fuso_negocio_aprovado,
      valido_de_aprovado,
      valido_ate_aprovado,
      novo_valido_de_aprovado,
      novo_valido_ate_aprovado
    )
    SELECT
      v.id,
      v.empresa_id,
      v.origem,
      COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus'),
      v.valido_de,
      v.valido_ate,
      (
        ((v.valido_de AT TIME ZONE '-04')::date)::timestamp
        AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus')
      )::timestamptz,
      CASE
        WHEN v.valido_ate IS NULL THEN NULL
        ELSE (
          ((v.valido_ate AT TIME ZONE '-04')::date)::timestamp
          AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), 'America/Manaus')
        )::timestamptz
      END
    FROM lexius_vigencia_elegivel_correcao_fuso el
    INNER JOIN titulo_rateio_vigencia v ON v.id = el.vigencia_id
    INNER JOIN empresas e ON e.id = v.empresa_id
    ON CONFLICT (vigencia_id) DO UPDATE SET
      empresa_id_aprovado = EXCLUDED.empresa_id_aprovado,
      origem_aprovada = EXCLUDED.origem_aprovada,
      fuso_negocio_aprovado = EXCLUDED.fuso_negocio_aprovado,
      valido_de_aprovado = EXCLUDED.valido_de_aprovado,
      valido_ate_aprovado = EXCLUDED.valido_ate_aprovado,
      novo_valido_de_aprovado = EXCLUDED.novo_valido_de_aprovado,
      novo_valido_ate_aprovado = EXCLUDED.novo_valido_ate_aprovado`);
}

export async function execMig020(
  dataSource: DataSource,
  opts?: {
    expectDivergenciaIds?: boolean;
    expectDivergenciaSnapshot?: boolean;
    expectEstruturaAusente?: boolean;
    expectAprovacaoIncompleta?: boolean;
    expectAprovacoesOrfas?: boolean;
  },
): Promise<void> {
  try {
    await dataSource.query(MIG020_EXEC);
  } catch (e) {
    await dataSource.query('ROLLBACK').catch(() => undefined);
    const msg = (e as Error).message ?? '';
    if (opts?.expectDivergenciaIds) {
      expect(msg).toMatch(/Divergência entre elegíveis e aprovados/i);
      return;
    }
    if (opts?.expectDivergenciaSnapshot) {
      expect(msg).toMatch(
        /Divergência entre snapshot aprovado|Destinos aprovados divergentes|snapshot aprovado e vigência/i,
      );
      return;
    }
    if (opts?.expectEstruturaAusente) {
      expect(msg).toMatch(/inexistente/i);
      return;
    }
    if (opts?.expectAprovacaoIncompleta) {
      expect(msg).toMatch(/Aprovação incompleta/i);
      return;
    }
    if (opts?.expectAprovacoesOrfas) {
      expect(msg).toMatch(/Aprovações órfãs/i);
      return;
    }
    throw e;
  }
}