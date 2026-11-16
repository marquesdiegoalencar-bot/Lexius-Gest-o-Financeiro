import { IsString } from 'class-validator';

export class CreateCentroCustoDto {
  @IsString()
  nome!: string;
}