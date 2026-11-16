import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('auditoria')
@Index(['entidade', 'entidadeId'])
export class Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid', nullable: true })
  empresaId!: string | null;

  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId!: string | null;

  @Column({ type: 'text' })
  entidade!: string;

  @Column({ name: 'entidade_id', type: 'uuid', nullable: true })
  entidadeId!: string | null;

  @Column({ type: 'text' })
  acao!: string;

  @Column({ type: 'jsonb', nullable: true })
  antes!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  depois!: Record<string, unknown> | null;

  @Column({ type: 'inet', nullable: true })
  ip!: string | null;

  @CreateDateColumn({ name: 'em', type: 'timestamptz' })
  em!: Date;
}