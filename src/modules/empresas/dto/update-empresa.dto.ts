import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateEmpresaDto {
  @IsOptional()
  @IsString()
  razao_social?: string;

  @IsOptional()
  @IsString()
  nome_fantasia?: string;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}