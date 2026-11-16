import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { TipoContaBancaria } from '../../../database/enums';

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
  @IsNumber()
  saldo_inicial?: number;

  @IsOptional()
  @IsDateString()
  data_saldo_inicial?: string;
}