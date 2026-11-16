import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsDateString,
  IsIn,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ParcelaAcordoDto } from './parcela-acordo.dto';
import { PessoaIntegracaoDto } from './pessoa-integracao.dto';

export class ReceberAcordoDto {
  @IsString()
  codigo!: string;

  @IsIn(['A_VISTA', 'PARCELADO', 'PARCELADO_COM_ENTRADA'])
  tipo!: string;

  @IsIn(['PIX', 'BOLETO'])
  forma_pagamento!: 'PIX' | 'BOLETO';

  @IsDateString()
  data_acordo!: string;

  @ValidateNested()
  @Type(() => PessoaIntegracaoDto)
  devedor!: PessoaIntegracaoDto;

  @ValidateNested()
  @Type(() => PessoaIntegracaoDto)
  credor!: PessoaIntegracaoDto;

  @IsNumber()
  @Min(0)
  valor_original!: number;

  @IsNumber()
  @Min(0)
  desconto!: number;

  @IsNumber()
  @Min(0)
  valor_acordado!: number;

  @ValidateNested({ each: true })
  @Type(() => ParcelaAcordoDto)
  @ArrayMinSize(1)
  parcelas!: ParcelaAcordoDto[];
}