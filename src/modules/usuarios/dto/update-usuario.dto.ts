import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PapelUsuario } from '../../../database/enums';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsBoolean()
  mfa_ativo?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  senha?: string;

  @IsOptional()
  @IsEnum(PapelUsuario)
  papel?: PapelUsuario;
}