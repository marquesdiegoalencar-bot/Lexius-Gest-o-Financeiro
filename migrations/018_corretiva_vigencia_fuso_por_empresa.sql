-- DEPRECADO para produção: correção ampla por assinatura -04 (risco de falso positivo em CONFIRMACAO/Manaus).
-- Use pré-flight + migration 019 com aprovação explícita. Ver docs/OPERACAO-MIGRACAO-VIGENCIA-FUSO.md
--
-- Mantido na cadeia apenas como no-op idempotente (compatibilidade de numeração).

BEGIN;
-- Intencionalmente vazio.
COMMIT;