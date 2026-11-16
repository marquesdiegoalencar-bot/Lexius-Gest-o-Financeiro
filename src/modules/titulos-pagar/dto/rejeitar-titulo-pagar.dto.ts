import { IsString, MinLength } from 'class-validator';

export class RejeitarTituloPagarDto {
  @IsString()
  @MinLength(3)
  motivo!: string;
}