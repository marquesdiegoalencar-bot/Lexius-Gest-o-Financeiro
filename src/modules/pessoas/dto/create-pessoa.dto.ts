import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TipoPessoa } from '../../../database/enums';

export class CreatePessoaDto {
  @IsEnum(TipoPessoa)
  tipo_pessoa!: TipoPessoa;

  @IsString()
  nome!: string;

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

  @IsOptional()
  @IsString()
  cobranca_ref_id?: string;
}