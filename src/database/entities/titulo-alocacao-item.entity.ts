import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('titulo_alocacao_item')
export class TituloAlocacaoItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'definicao_id', type: 'uuid' })
  definicaoId!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ type: 'smallint' })
  linha!: number;

  @Column({ name: 'centro_custo_id', type: 'uuid', nullable: true })
  centroCustoId!: string | null;

  @Column({ name: 'departamento_id', type: 'uuid', nullable: true })
  departamentoId!: string | null;

  @Column({ type: 'numeric', precision: 9, scale: 4, nullable: true })
  percentual!: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  valor!: string | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;
}