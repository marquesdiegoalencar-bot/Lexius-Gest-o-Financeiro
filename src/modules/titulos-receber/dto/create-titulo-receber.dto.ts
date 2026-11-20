import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { FormaPagamento } from '../../../database/enums';

export class CreateTituloReceberDto {
  @IsString()
  descricao!: string;

  @IsUUID()
  categoria_id!: string;

  @IsNumber()
  @Min(0.01)
  valor_original!: number;

  @IsDateString()
  data_vencimento!: string;

  @IsOptional()
  @IsUUID()
  pessoa_id?: string;

  @IsOptional()
  @IsUUID()
  credor_id?: string;

  @IsOptional()
  @IsUUID()
  centro_custo_id?: string;

  @IsOptional()
  @IsUUID()
  departamento_id?: string;

  @IsOptional()
  @IsUUID()
  conta_bancaria_id?: string;

  @IsOptional()
  @IsDateString()
  data_competencia?: string;

  @IsOptional()
  @IsEnum(FormaPagamento)
  forma_prevista?: FormaPagamento;

  @IsOptional()
  @IsString()
  observacao?: string;
}