import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDepartamentoDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  codigo?: string;

  @IsString()
  @IsNotEmpty({ message: 'Nome do departamento é obrigatório' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}