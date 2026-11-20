import { IsEnum, IsOptional } from 'class-validator';
import { ModoRateio } from '../../../database/enums';

export class IniciarRateioDto {
  @IsOptional()
  @IsEnum(ModoRateio)
  modo?: ModoRateio;
}