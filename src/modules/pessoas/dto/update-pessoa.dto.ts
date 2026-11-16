import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePessoaDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(14)
  documento?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsBoolean()
  eh_cliente?: boolean;

  @IsOptional()
  @IsBoolean()
  eh_fornecedor?: boolean;

  @IsOptional()
  @IsBoolean()
  eh_credor?: boolean;

  @IsOptional()
  @IsBoolean()
  eh_colaborador?: boolean;

  @IsOptional()
  @IsBoolean()
  eh_advogado?: boolean;
}