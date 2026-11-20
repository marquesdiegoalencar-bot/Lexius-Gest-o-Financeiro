import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

export class RateioItemLinhaDto {
  @IsNumber()
  @Min(1)
  linha!: number;

  @IsOptional()
  @IsUUID()
  centro_custo_id?: string;

  @IsOptional()
  @IsUUID()
  departamento_id?: string;

  @IsOptional()
  @IsNumber()
  percentual?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valor?: number;
}

export class SalvarRateioItensDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RateioItemLinhaDto)
  itens!: RateioItemLinhaDto[];
}