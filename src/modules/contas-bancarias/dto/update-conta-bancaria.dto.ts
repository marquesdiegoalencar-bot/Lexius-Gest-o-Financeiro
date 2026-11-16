import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateContaBancariaDto {
  @IsOptional()
  @IsString()
  apelido?: string;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;
}