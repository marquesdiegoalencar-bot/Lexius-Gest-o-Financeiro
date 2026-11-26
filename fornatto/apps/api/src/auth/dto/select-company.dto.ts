import { IsString, MinLength } from 'class-validator';

export class SelectCompanyDto {
  @IsString()
  @MinLength(1)
  companyId!: string;
}