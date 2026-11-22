import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateContaBancariaDto {
  @IsOptional()
  @IsString()
  apelido?: string;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;

  @IsOptional()
  @IsString()
  chave_pix?: string;

  @IsOptional()
  @IsString()
  tipo_chave_pix?: string;

  @IsOptional()
  @IsString()
  credencial_ref?: string;

  @IsOptional()
  @IsBoolean()
  sincroniza_extrato?: boolean;
}