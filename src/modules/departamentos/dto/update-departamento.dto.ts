import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDepartamentoDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  codigo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Nome do departamento é obrigatório' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}