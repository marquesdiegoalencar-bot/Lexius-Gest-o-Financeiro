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

  @IsOptional()
  @IsBooleanString()
  INTER_USE_MOCK?: string;

  @IsOptional()
  @IsString()
  WEBHOOK_INTER_MOCK_SECRET?: string;
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

  const nodeEnv = String(config.NODE_ENV ?? 'development').toLowerCase();
  if (nodeEnv === 'production') {
    if (config.INTER_USE_MOCK === 'true') {
      throw new Error('INTER_USE_MOCK não pode ser true em NODE_ENV=production');
    }
    if (config.WEBHOOK_INTER_MOCK_SECRET) {
      throw new Error('WEBHOOK_INTER_MOCK_SECRET não pode ser definido em production');
    }
  }

  return validated;
}