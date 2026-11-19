import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TipoCentroCusto, TipoNoCentroCusto } from '../../../database/enums';

export class UpdateCentroCustoDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  codigo?: string;

  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsEnum(TipoCentroCusto)
  tipo?: TipoCentroCusto;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsUUID()
  pai_id?: string | null;

  @IsOptional()
  @IsEnum(TipoNoCentroCusto)
  tipo_no?: TipoNoCentroCusto;
}