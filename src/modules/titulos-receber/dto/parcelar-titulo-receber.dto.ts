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
  ValidateNested,
} from 'class-validator';
import { FormaPagamento } from '../../../database/enums';

class ParcelaReceberDto {
  @IsString()
  descricao!: string;

  @IsNumber()
  @Min(0.01)
  valor_original!: number;

  @IsDateString()
  data_vencimento!: string;

  @IsOptional()
  @IsEnum(FormaPagamento)
  forma_prevista?: FormaPagamento;
}

export class ParcelarTituloReceberDto {
  @IsUUID()
  categoria_id!: string;

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
  @IsString()
  observacao?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => ParcelaReceberDto)
  parcelas!: ParcelaReceberDto[];
}