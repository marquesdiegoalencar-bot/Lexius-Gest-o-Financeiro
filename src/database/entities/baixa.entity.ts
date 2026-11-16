import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { FormaPagamento } from '../enums';

@Entity('baixas')
export class Baixa {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ name: 'titulo_receber_id', type: 'uuid', nullable: true })
  tituloReceberId!: string | null;

  @Column({ name: 'titulo_pagar_id', type: 'uuid', nullable: true })
  tituloPagarId!: string | null;

  @Column({ name: 'conta_bancaria_id', type: 'uuid' })
  contaBancariaId!: string;

  @Column({ name: 'movimento_id', type: 'uuid', nullable: true })
  movimentoId!: string | null;

  @Column({ name: 'movimento_tarifa_id', type: 'uuid', nullable: true })
  movimentoTarifaId!: string | null;

  @Column({ name: 'data_baixa', type: 'date' })
  dataBaixa!: string;

  @Column({ name: 'valor_principal', type: 'numeric', precision: 14, scale: 2 })
  valorPrincipal!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  juros!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  multa!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  desconto!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  tarifa!: string;

  @Column({ name: 'valor_liquido', type: 'numeric', precision: 14, scale: 2 })
  valorLiquido!: string;

  @Column({ type: 'enum', enum: FormaPagamento, enumName: 'forma_pagamento' })
  forma!: FormaPagamento;

  @Column({ default: false })
  automatica!: boolean;

  @Column({ name: 'origem_evento_id', type: 'uuid', nullable: true })
  origemEventoId!: string | null;

  @Column({ type: 'text', nullable: true })
  observacao!: string | null;

  @Column({ default: false })
  estornada!: boolean;

  @Column({ name: 'estornada_em', type: 'timestamptz', nullable: true })
  estornadaEm!: Date | null;

  @Column({ name: 'estornada_por', type: 'uuid', nullable: true })
  estornadaPor!: string | null;

  @Column({ name: 'motivo_estorno', type: 'text', nullable: true })
  motivoEstorno!: string | null;

  @Column({ name: 'criada_por', type: 'uuid', nullable: true })
  criadaPor!: string | null;

  @CreateDateColumn({ name: 'criada_em', type: 'timestamptz' })
  criadaEm!: Date;
}