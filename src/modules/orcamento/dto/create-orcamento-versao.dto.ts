import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateOrcamentoVersaoDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  ano!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;

  @IsOptional()
  @IsString()
  nome?: string;
}