import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TipoCentroCusto } from '../../../database/enums';

export class CreateCentroCustoDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  codigo?: string;

  @IsString()
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsEnum(TipoCentroCusto)
  tipo?: TipoCentroCusto;
}