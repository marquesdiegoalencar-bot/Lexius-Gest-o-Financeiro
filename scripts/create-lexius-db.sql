-- Cria o banco no PostgreSQL da VPS (rodar como superuser postgres).
-- Ex.: psql -U postgres -f scripts/create-lexius-db.sql
SELECT 'CREATE DATABASE lexius_financeiro ENCODING UTF8'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'lexius_financeiro')\gexec