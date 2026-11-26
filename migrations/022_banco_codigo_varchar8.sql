-- Código banco: COMPE (3) ou ISPB (8)
ALTER TABLE contas_bancarias
  ALTER COLUMN banco_codigo TYPE VARCHAR(8);

ALTER TABLE pessoa_dados_bancarios
  ALTER COLUMN banco_codigo TYPE VARCHAR(8);