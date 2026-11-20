import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Natureza } from '../../../database/enums';

export class FiltroDreDto {
  @IsDateString()
  de!: string;

  @IsDateString()
  ate!: string;

  @IsOptional()
  @IsEnum(Natureza)
  natureza?: Natureza;

  @IsOptional()
  @IsUUID()
  categoria_id?: string;

  @IsOptional()
  @IsUUID()
  centro_custo_id?: string;

  @IsOptional()
  @IsUUID()
  departamento_id?: string;
}