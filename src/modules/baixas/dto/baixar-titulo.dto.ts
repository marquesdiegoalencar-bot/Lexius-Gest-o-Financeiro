import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FormaPagamento } from '../../../database/enums';

export class BaixarTituloDto {
  @IsString()
  conta_bancaria_id!: string;

  @IsDateString()
  data_baixa!: string;

  @IsNumber()
  @Min(0)
  valor_principal!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  juros?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  desconto?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  multa?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tarifa?: number;

  @IsEnum(FormaPagamento)
  forma!: FormaPagamento;

  @IsOptional()
  @IsString()
  observacao?: string;
}