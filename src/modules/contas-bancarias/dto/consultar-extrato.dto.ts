import { IsDateString, IsOptional } from 'class-validator';

export class ConsultarExtratoDto {
  @IsOptional()
  @IsDateString()
  de?: string;

  @IsOptional()
  @IsDateString()
  ate?: string;
}