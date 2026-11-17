import { IsBoolean, IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class AtualizarRegraRepasseDto {
  @IsOptional()
  @IsIn(['MANUAL', 'FIXO'])
  comissao_modo?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentual_comissao?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentual_honorarios?: number;

  @IsOptional()
  @IsBoolean()
  descontar_taxa_boleto?: boolean;

  @IsOptional()
  @IsBoolean()
  descontar_taxa_bancaria?: boolean;

  @IsOptional()
  @IsIn(['DIARIO', 'SEMANAL', 'QUINZENAL', 'MENSAL', 'MANUAL'])
  periodicidade?: string;

  @IsOptional()
  @IsNumber()
  dia_repasse?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valor_minimo?: number;
}