import { IsBoolean, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { TipoEmpresa } from '../../../database/enums';

export class UpdateEmpresaDto {
  @IsOptional()
  @IsString()
  razao_social?: string;

  @IsOptional()
  @IsString()
  nome_fantasia?: string | null;

  @IsOptional()
  @IsEnum(TipoEmpresa)
  tipo?: TipoEmpresa;

  @IsOptional()
  @IsString()
  @Length(14, 14)
  @Matches(/^\d{14}$/)
  cnpj?: string;

  @IsOptional()
  @IsString()
  fuso_negocio?: string;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}