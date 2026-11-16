import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Natureza } from '../../../database/enums';

export class CreateCategoriaDto {
  @IsOptional()
  @IsUUID()
  empresa_id?: string;

  @IsOptional()
  @IsUUID()
  pai_id?: string;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsString()
  nome!: string;

  @IsEnum(Natureza)
  natureza!: Natureza;
}