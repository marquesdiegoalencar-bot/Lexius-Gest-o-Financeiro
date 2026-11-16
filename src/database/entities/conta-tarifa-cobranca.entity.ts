import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { FormaPagamento } from '../enums';

@Entity('conta_tarifas_cobranca')
@Unique(['contaBancariaId', 'forma'])
export class ContaTarifaCobranca {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conta_bancaria_id', type: 'uuid' })
  contaBancariaId!: string;

  @Column({ type: 'enum', enum: FormaPagamento, enumName: 'forma_pagamento' })
  forma!: FormaPagamento;

  @Column({ name: 'valor_tarifa', type: 'numeric', precision: 14, scale: 2, default: 0 })
  valorTarifa!: string;
}