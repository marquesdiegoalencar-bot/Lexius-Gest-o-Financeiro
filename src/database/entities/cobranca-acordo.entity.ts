import { Column, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { FormaPagamento } from '../enums';

@Entity('cobranca_acordos')
@Unique(['empresaId', 'codigo'])
export class CobrancaAcordo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ type: 'text' })
  codigo!: string;

  @Column({ name: 'devedor_id', type: 'uuid' })
  devedorId!: string;

  @Column({ name: 'credor_id', type: 'uuid' })
  credorId!: string;

  @Column({ type: 'text' })
  tipo!: string;

  @Column({ name: 'forma_pagamento', type: 'enum', enum: FormaPagamento, enumName: 'forma_pagamento' })
  formaPagamento!: FormaPagamento;

  @Column({ name: 'valor_original', type: 'numeric', precision: 14, scale: 2 })
  valorOriginal!: string;

  @Column({ name: 'valor_acordado', type: 'numeric', precision: 14, scale: 2 })
  valorAcordado!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  desconto!: string;

  @Column({ name: 'valor_entrada', type: 'numeric', precision: 14, scale: 2, default: 0 })
  valorEntrada!: string;

  @Column({ name: 'qtd_parcelas', type: 'smallint', default: 1 })
  qtdParcelas!: number;

  @Column({ name: 'data_acordo', type: 'date' })
  dataAcordo!: string;

  @Column({ name: 'primeiro_vencimento', type: 'date', nullable: true })
  primeiroVencimento!: string | null;

  @Column({ name: 'status_acordo', type: 'text', default: 'ATIVO' })
  statusAcordo!: string;

  @Column({ name: 'status_pagamento', type: 'text', default: 'PENDENTE' })
  statusPagamento!: string;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;
}