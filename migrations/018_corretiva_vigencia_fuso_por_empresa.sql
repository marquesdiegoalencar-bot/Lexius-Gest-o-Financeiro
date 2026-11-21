-- DEPRECADO para produção: correção ampla por assinatura -04 (risco de falso positivo em CONFIRMACAO/Manaus).
-- Use pré-flight + 019 (estrutura) + 019a + populate + 021 (operacional). Ver docs/OPERACAO-MIGRACAO-VIGENCIA-FUSO.md
--
-- Mantido na cadeia apenas como no-op idempotente (compatibilidade de numeração).

BEGIN;
-- Intencionalmente vazio.
COMMIT;