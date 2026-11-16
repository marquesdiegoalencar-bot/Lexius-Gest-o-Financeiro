import { plainToInstance } from 'class-transformer';
import {
  IsBooleanString,
  IsNotEmpty,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsString()
  NODE_ENV?: string;

  @IsOptional()
  @IsString()
  PORT?: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsOptional()
  @IsBooleanString()
  DB_SYNC_SCHEMA?: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  @IsString()
  @IsNotEmpty()
  COB_INTEGRACAO_API_KEY!: string;

  @IsString()
  @IsNotEmpty()
  COB_INTEGRACAO_HMAC_SECRET!: string;

  @IsOptional()
  @IsString()
  COB_EMPRESA_CNPJ?: string;

  @IsOptional()
  @IsString()
  STORAGE_LOCAL_PATH?: string;

  @IsOptional()
  @IsString()
  ANEXO_MAX_BYTES?: string;

  @IsOptional()
  @IsString()
  ANEXO_MIME_ALLOWED?: string;
}

export function envValidation(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Configuração inválida: ${errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('; ')}`,
    );
  }
  return validated;
}