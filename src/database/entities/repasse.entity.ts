import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { StatusRepasse } from '../enums';

@Entity('repasses')
export class Repasse {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ name: 'credor_id', type: 'uuid' })
  credorId!: string;

  @Column({ name: 'conta_origem_id', type: 'uuid' })
  contaOrigemId!: string;

  @Column({ name: 'periodo_inicio', type: 'date' })
  periodoInicio!: string;

  @Column({ name: 'periodo_fim', type: 'date' })
  periodoFim!: string;

  @Column({ name: 'total_recebido', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalRecebido!: string;

  @Column({ name: 'percentual_comissao', type: 'numeric', precision: 5, scale: 2, default: 0 })
  percentualComissao!: string;

  @Column({ name: 'total_comissao', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalComissao!: string;

  @Column({ name: 'total_honorarios', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalHonorarios!: string;

  @Column({ name: 'total_tarifas', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalTarifas!: string;

  @Column({ name: 'outros_descontos', type: 'numeric', precision: 14, scale: 2, default: 0 })
  outrosDescontos!: string;

  @Column({ name: 'total_repasse', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalRepasse!: string;

  @Column({
    type: 'enum',
    enum: StatusRepasse,
    enumName: 'status_repasse',
    default: StatusRepasse.RASCUNHO,
  })
  status!: StatusRepasse;

  @Column({ name: 'pagamento_id', type: 'uuid', nullable: true })
  pagamentoId!: string | null;

  @Column({ name: 'data_repasse', type: 'date', nullable: true })
  dataRepasse!: string | null;

  @Column({ type: 'text', nullable: true })
  observacao!: string | null;

  @Column({ name: 'rascunho_baixa_ids', type: 'uuid', array: true, nullable: true })
  rascunhoBaixaIds!: string[] | null;

  @Column({ name: 'criado_por', type: 'uuid', nullable: true })
  criadoPor!: string | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;
}