import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TipoCentroCusto } from '../../../database/enums';

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
}