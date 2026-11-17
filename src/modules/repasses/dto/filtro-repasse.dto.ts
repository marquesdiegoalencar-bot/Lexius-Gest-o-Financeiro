import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { StatusRepasse } from '../../../database/enums';

export class FiltroRepasseDto {
  @IsOptional()
  @IsUUID()
  credor_id?: string;

  @IsOptional()
  @IsEnum(StatusRepasse)
  status?: StatusRepasse;
}