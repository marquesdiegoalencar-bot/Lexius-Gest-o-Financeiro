import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

export class OrcamentoItemLinhaDto {
  @IsUUID()
  categoria_id!: string;

  @IsOptional()
  @IsUUID()
  centro_custo_id?: string;

  @IsOptional()
  @IsUUID()
  departamento_id?: string;

  @IsNumber()
  @Min(0)
  valor_previsto!: number;
}

export class SalvarOrcamentoItensDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrcamentoItemLinhaDto)
  itens!: OrcamentoItemLinhaDto[];
}