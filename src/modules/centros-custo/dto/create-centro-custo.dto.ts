import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TipoCentroCusto, TipoNoCentroCusto } from '../../../database/enums';

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

  @IsOptional()
  @IsUUID()
  pai_id?: string;

  @IsOptional()
  @IsEnum(TipoNoCentroCusto)
  tipo_no?: TipoNoCentroCusto;
}