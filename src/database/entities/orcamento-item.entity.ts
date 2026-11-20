import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('orcamento_item')
export class OrcamentoItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'versao_id', type: 'uuid' })
  versaoId!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ name: 'categoria_id', type: 'uuid' })
  categoriaId!: string;

  @Column({ name: 'centro_custo_id', type: 'uuid', nullable: true })
  centroCustoId!: string | null;

  @Column({ name: 'departamento_id', type: 'uuid', nullable: true })
  departamentoId!: string | null;

  @Column({ name: 'valor_previsto', type: 'numeric', precision: 14, scale: 2 })
  valorPrevisto!: string;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;
}