import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { FormaPagamento } from '../../../database/enums';

class ParcelaPagarDto {
  @IsString()
  descricao!: string;

  @IsNumber()
  @Min(0.01)
  valor_original!: number;

  @IsDateString()
  data_vencimento!: string;
}

export class CreateTituloPagarDto {
  @ValidateIf((o: CreateTituloPagarDto) => !o.parcelas?.length)
  @IsString()
  descricao?: string;

  @IsUUID()
  categoria_id!: string;

  @ValidateIf((o: CreateTituloPagarDto) => !o.parcelas?.length)
  @IsNumber()
  @Min(0.01)
  valor_original?: number;

  @ValidateIf((o: CreateTituloPagarDto) => !o.parcelas?.length)
  @IsDateString()
  data_vencimento?: string;

  @IsOptional()
  @IsUUID()
  fornecedor_id?: string;

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
  @IsUUID()
  recorrencia_id?: string;

  @IsOptional()
  @IsDateString()
  data_competencia?: string;

  @IsOptional()
  @IsEnum(FormaPagamento)
  forma_prevista?: FormaPagamento;

  @IsOptional()
  @IsString()
  observacao?: string;

  /** Se informado, cria parcelado em vez de título único */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => ParcelaPagarDto)
  parcelas?: ParcelaPagarDto[];
}