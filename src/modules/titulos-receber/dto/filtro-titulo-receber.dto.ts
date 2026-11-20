import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { OrigemTitulo, StatusTitulo } from '../../../database/enums';

export class FiltroTituloReceberDto {
  @IsOptional()
  @IsDateString()
  de?: string;

  @IsOptional()
  @IsDateString()
  ate?: string;

  @IsOptional()
  @IsEnum(StatusTitulo)
  status?: StatusTitulo;

  @IsOptional()
  @IsUUID()
  pessoa_id?: string;

  @IsOptional()
  @IsUUID()
  categoria_id?: string;

  @IsOptional()
  @IsEnum(OrigemTitulo)
  origem?: OrigemTitulo;

  @IsOptional()
  @IsUUID()
  departamento_id?: string;

  @IsOptional()
  @IsUUID()
  centro_custo_id?: string;
}