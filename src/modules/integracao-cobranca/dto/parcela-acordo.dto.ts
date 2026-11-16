import { IsDateString, IsIn, IsInt, IsNumber, IsString, Min } from 'class-validator';

export class ParcelaAcordoDto {
  @IsString()
  id_parcela!: string;

  @IsInt()
  @Min(0)
  numero!: number;

  @IsIn(['ENTRADA', 'PARCELA'])
  tipo!: 'ENTRADA' | 'PARCELA';

  @IsNumber()
  @Min(0.01)
  valor!: number;

  @IsDateString()
  vencimento!: string;
}