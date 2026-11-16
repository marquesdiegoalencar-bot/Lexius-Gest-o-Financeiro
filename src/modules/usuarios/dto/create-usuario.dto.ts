import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { PapelUsuario } from '../../../database/enums';

export class CreateUsuarioDto {
  @IsString()
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  senha!: string;

  @IsUUID()
  empresa_id!: string;

  @IsEnum(PapelUsuario)
  papel!: PapelUsuario;

  @IsOptional()
  @IsString()
  cobranca_user_id?: string;
}