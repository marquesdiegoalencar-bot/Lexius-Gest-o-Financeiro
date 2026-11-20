-- Pré-flight READ-ONLY — vigências potencialmente afetadas pela conversão fixa -04 (017 antiga).
-- Não executa UPDATE. Rodar em ambiente autorizado: psql "$DATABASE_URL" -f scripts/sql/preflight-vigencia-fuso-017-legacy.sql
--
-- Classificação:
--   A = LEGADO fora de Manaus | B = LEGADO em Manaus | C = CONFIRMACAO fora de Manaus
--   D = CONFIRMACAO em Manaus     | E = Outras / ambíguos
-- Candidato à correção restrita (019): somente A com assinatura -04 e instante divergente do recálculo.

\pset pager off

WITH params AS (
  SELECT 'America/Manaus'::text AS fuso_padrao
),
base AS (
  SELECT
    v.id AS vigencia_id,
    v.empresa_id,
    e.razao_social,
    COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), p.fuso_padrao) AS fuso_negocio,
    v.origem::text AS origem,
    v.valido_de AS valido_de_atual,
    v.valido_ate AS valido_ate_atual,
  (v.valido_de AT TIME ZONE '-04')::date AS dia_civil_de_recuperado,
  (v.valido_ate AT TIME ZONE '-04')::date AS dia_civil_ate_recuperado,
  (
    ((v.valido_de AT TIME ZONE '-04')::date)::timestamp
    AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), p.fuso_padrao)
  )::timestamptz AS novo_valido_de,
  CASE
    WHEN v.valido_ate IS NULL THEN NULL
    ELSE (
      ((v.valido_ate AT TIME ZONE '-04')::date)::timestamp
      AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), p.fuso_padrao)
    )::timestamptz
  END AS novo_valido_ate,
  (
    v.valido_de = (
      ((v.valido_de AT TIME ZONE '-04')::date::text) || ' 00:00:00-04'
    )::timestamptz
  ) AS assinatura_menos4_de,
  (
    v.valido_ate IS NOT NULL
    AND v.valido_ate = (
      ((v.valido_ate AT TIME ZONE '-04')::date::text) || ' 00:00:00-04'
    )::timestamptz
  ) AS assinatura_menos4_ate,
    v.valido_de IS DISTINCT FROM (
      ((v.valido_de AT TIME ZONE '-04')::date)::timestamp
      AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), p.fuso_padrao)
    )::timestamptz AS diff_valido_de,
    (
      v.valido_ate IS NOT NULL
      AND v.valido_ate IS DISTINCT FROM (
        ((v.valido_ate AT TIME ZONE '-04')::date)::timestamp
        AT TIME ZONE COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), p.fuso_padrao)
      )::timestamptz
    ) AS diff_valido_ate
  FROM titulo_rateio_vigencia v
  INNER JOIN empresas e ON e.id = v.empresa_id
  CROSS JOIN params p
),
classificado AS (
  SELECT
    b.*,
    CASE
      WHEN origem = 'LEGADO'
        AND fuso_negocio <> (SELECT fuso_padrao FROM params)
        THEN 'A'
      WHEN origem = 'LEGADO'
        AND fuso_negocio = (SELECT fuso_padrao FROM params)
        THEN 'B'
      WHEN origem = 'CONFIRMACAO'
        AND fuso_negocio <> (SELECT fuso_padrao FROM params)
        THEN 'C'
      WHEN origem = 'CONFIRMACAO'
        AND fuso_negocio = (SELECT fuso_padrao FROM params)
        THEN 'D'
      ELSE 'E'
    END AS classificacao,
    CASE
      WHEN origem = 'LEGADO'
        AND fuso_negocio <> (SELECT fuso_padrao FROM params)
        AND assinatura_menos4_de
        AND diff_valido_de
        THEN 'CORRIGIR_LEGADO_FORA_MANAUS'
      WHEN origem = 'LEGADO'
        AND fuso_negocio = (SELECT fuso_padrao FROM params)
        AND (assinatura_menos4_de OR assinatura_menos4_ate)
        AND NOT diff_valido_de
        AND NOT diff_valido_ate
        THEN 'LEGADO_MANAUS_JA_CORRETO'
      WHEN origem = 'LEGADO'
        AND fuso_negocio = (SELECT fuso_padrao FROM params)
        AND (diff_valido_de OR diff_valido_ate)
        THEN 'LEGADO_MANAUS_REQUER_ANALISE'
      WHEN origem = 'CONFIRMACAO' THEN 'NAO_CORRIGIR_AUTOMATICO_CONFIRMACAO'
      ELSE 'NAO_CORRIGIR_AUTOMATICO_OUTROS'
    END AS acao_sugerida
  FROM base b
)
SELECT
  vigencia_id,
  empresa_id,
  razao_social,
  fuso_negocio,
  origem,
  valido_de_atual,
  valido_ate_atual,
  dia_civil_de_recuperado,
  novo_valido_de,
  CASE WHEN diff_valido_de THEN novo_valido_de - valido_de_atual ELSE NULL END AS delta_valido_de,
  novo_valido_ate,
  classificacao,
  acao_sugerida,
  assinatura_menos4_de,
  assinatura_menos4_ate
FROM classificado
WHERE assinatura_menos4_de OR assinatura_menos4_ate
ORDER BY classificacao, razao_social, vigencia_id;

\echo '--- Resumo por classificação (assinatura -04) ---'
WITH params AS (SELECT 'America/Manaus'::text AS fuso_padrao),
base AS (
  SELECT v.*, e.razao_social, COALESCE(NULLIF(TRIM(e.fuso_negocio), ''), p.fuso_padrao) AS fuso_negocio,
    (v.valido_de = (((v.valido_de AT TIME ZONE '-04')::date::text) || ' 00:00:00-04')::timestamptz) AS sig
  FROM titulo_rateio_vigencia v
  JOIN empresas e ON e.id = v.empresa_id
  CROSS JOIN params p
  WHERE v.valido_de = (((v.valido_de AT TIME ZONE '-04')::date::text) || ' 00:00:00-04')::timestamptz
)
SELECT
  CASE
    WHEN origem::text = 'LEGADO' AND fuso_negocio <> 'America/Manaus' THEN 'A'
    WHEN origem::text = 'LEGADO' THEN 'B'
    WHEN origem::text = 'CONFIRMACAO' AND fuso_negocio <> 'America/Manaus' THEN 'C'
    WHEN origem::text = 'CONFIRMACAO' THEN 'D'
    ELSE 'E'
  END AS classificacao,
  COUNT(*) AS qtd
FROM base
GROUP BY 1
ORDER BY 1;