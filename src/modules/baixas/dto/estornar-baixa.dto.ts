import { IsString, MinLength } from 'class-validator';

export class EstornarBaixaDto {
  @IsString()
  @MinLength(3)
  motivo!: string;
}