import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Natureza } from '../../../database/enums';

export class CreateRecorrenciaDto {
  @IsEnum(Natureza)
  natureza!: Natureza;

  @IsString()
  descricao!: string;

  @IsUUID()
  categoria_id!: string;

  @IsNumber()
  @Min(0.01)
  valor!: number;

  @IsString()
  frequencia!: string;

  @IsDateString()
  inicio!: string;

  @IsOptional()
  @IsDateString()
  fim?: string;

  @IsOptional()
  @IsUUID()
  pessoa_id?: string;

  @IsOptional()
  @IsUUID()
  conta_bancaria_id?: string;

  @IsOptional()
  @IsNumber()
  dia_vencimento?: number;

  @IsOptional()
  @IsNumber()
  gerar_antecedencia_dias?: number;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}