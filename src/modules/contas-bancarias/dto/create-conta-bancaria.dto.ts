import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ProvedorBancario, TipoContaBancaria } from '../../../database/enums';

export class CreateContaBancariaDto {
  @IsString()
  @Length(1, 120)
  apelido!: string;

  @IsString()
  @Length(1, 8)
  @Matches(/^\d+$/, { message: 'banco_codigo deve conter apenas dígitos' })
  banco_codigo!: string;

  @IsOptional()
  @IsString()
  agencia?: string;

  @IsOptional()
  @IsString()
  conta?: string;

  @IsOptional()
  @IsEnum(TipoContaBancaria)
  tipo?: TipoContaBancaria;

  @IsOptional()
  @IsEnum(ProvedorBancario)
  provedor?: ProvedorBancario;

  @IsOptional()
  @IsString()
  credencial_ref?: string;

  @IsOptional()
  @IsBoolean()
  sincroniza_extrato?: boolean;

  @IsOptional()
  @IsString()
  chave_pix?: string;

  @IsOptional()
  @IsString()
  tipo_chave_pix?: string;

  @IsOptional()
  @IsNumber()
  saldo_inicial?: number;

  @IsOptional()
  @IsDateString()
  data_saldo_inicial?: string;
}