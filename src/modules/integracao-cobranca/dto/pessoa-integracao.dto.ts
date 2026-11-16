import { IsOptional, IsString } from 'class-validator';

export class PessoaIntegracaoDto {
  @IsString()
  nome!: string;

  @IsOptional()
  @IsString()
  documento?: string;
}