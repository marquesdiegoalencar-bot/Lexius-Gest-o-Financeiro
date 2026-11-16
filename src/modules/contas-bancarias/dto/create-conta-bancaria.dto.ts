import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { ProvedorBancario, TipoContaBancaria } from '../../../database/enums';

export class CreateContaBancariaDto {
  @IsString()
  apelido!: string;

  @IsString()
  @Length(3, 3)
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