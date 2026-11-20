import { IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { ModoRateio } from '../../../database/enums';

export class ConfirmarRateioDto {
  /** Início da vigência (TIMESTAMPTZ ISO ou data YYYY-MM-DD → 00:00 no fuso da empresa). */
  @IsISO8601()
  vigente_desde!: string;

  @IsOptional()
  @IsEnum(ModoRateio)
  modo?: ModoRateio;
}