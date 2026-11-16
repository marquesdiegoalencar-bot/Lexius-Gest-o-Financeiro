import { IsDateString, IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class CreateIntergrupoDto {
  @IsString()
  descricao!: string;

  @IsUUID()
  empresa_credora_id!: string;

  @IsUUID()
  empresa_devedora_id!: string;

  @IsUUID()
  categoria_receita_id!: string;

  @IsUUID()
  categoria_despesa_id!: string;

  @IsNumber()
  @Min(0.01)
  valor!: number;

  @IsDateString()
  data_vencimento!: string;
}