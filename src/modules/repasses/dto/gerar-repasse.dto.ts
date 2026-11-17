import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class GerarRepasseDto {
  @IsUUID()
  credor_id!: string;

  @IsUUID()
  conta_origem_id!: string;

  @IsDateString()
  periodo_inicio!: string;

  @IsDateString()
  periodo_fim!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  percentual_comissao!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  baixa_ids!: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  outros_descontos?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_honorarios?: number;

  @IsOptional()
  observacao?: string;
}