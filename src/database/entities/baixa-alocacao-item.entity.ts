import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TipoBaixaAlocacao } from '../enums';

@Entity('baixa_alocacao_item')
export class BaixaAlocacaoItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ name: 'baixa_id', type: 'uuid' })
  baixaId!: string;

  @Column({
    type: 'enum',
    enum: TipoBaixaAlocacao,
    enumName: 'tipo_baixa_alocacao',
    default: TipoBaixaAlocacao.BAIXA,
  })
  tipo!: TipoBaixaAlocacao;

  @Column({ type: 'smallint' })
  linha!: number;

  @Column({ name: 'centro_custo_id', type: 'uuid', nullable: true })
  centroCustoId!: string | null;

  @Column({ name: 'departamento_id', type: 'uuid', nullable: true })
  departamentoId!: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  valor!: string;

  @Column({ name: 'percentual_ref', type: 'numeric', precision: 9, scale: 4, nullable: true })
  percentualRef!: string | null;

  @Column({ name: 'vigencia_id', type: 'uuid', nullable: true })
  vigenciaId!: string | null;

  @Column({ name: 'estorno_de_id', type: 'uuid', nullable: true })
  estornoDeId!: string | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;
}