import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { TipoEmpresa } from '../../../database/enums';

export class CreateEmpresaDto {
  @IsEnum(TipoEmpresa)
  tipo!: TipoEmpresa;

  @IsString()
  razao_social!: string;

  @IsOptional()
  @IsString()
  nome_fantasia?: string;

  @IsString()
  @Length(14, 14)
  @Matches(/^\d{14}$/)
  cnpj!: string;

  @IsOptional()
  @IsString()
  fuso_negocio?: string;
}