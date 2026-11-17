import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('credor_regras_repasse')
export class CredorRegraRepasse {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ name: 'credor_id', type: 'uuid' })
  credorId!: string;

  @Column({ name: 'comissao_modo', type: 'text', default: 'MANUAL' })
  comissaoModo!: string;

  @Column({ name: 'percentual_comissao', type: 'numeric', precision: 5, scale: 2, default: 0 })
  percentualComissao!: string;

  @Column({ name: 'percentual_honorarios', type: 'numeric', precision: 5, scale: 2, default: 0 })
  percentualHonorarios!: string;

  @Column({ name: 'descontar_taxa_boleto', default: true })
  descontarTaxaBoleto!: boolean;

  @Column({ name: 'descontar_taxa_bancaria', default: true })
  descontarTaxaBancaria!: boolean;

  @Column({ type: 'text', default: 'SEMANAL' })
  periodicidade!: string;

  @Column({ name: 'dia_repasse', type: 'smallint', nullable: true })
  diaRepasse!: number | null;

  @Column({ name: 'valor_minimo', type: 'numeric', precision: 14, scale: 2, default: 0 })
  valorMinimo!: string;

  @Column({ name: 'vigente_desde', type: 'date' })
  vigenteDesde!: string;

  @Column({ name: 'vigente_ate', type: 'date', nullable: true })
  vigenteAte!: string | null;
}