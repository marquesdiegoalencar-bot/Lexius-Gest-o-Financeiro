import { IsString, MinLength } from 'class-validator';

export class RedefinirSenhaDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8, { message: 'A nova senha deve ter no mínimo 8 caracteres' })
  nova_senha!: string;
}