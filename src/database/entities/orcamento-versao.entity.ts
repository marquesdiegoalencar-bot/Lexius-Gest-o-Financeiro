import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StatusOrcamentoVersao } from '../enums';

@Entity('orcamento_versao')
export class OrcamentoVersao {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ type: 'smallint' })
  ano!: number;

  @Column({ type: 'smallint' })
  mes!: number;

  @Column({ type: 'text', nullable: true })
  nome!: string | null;

  @Column({
    type: 'enum',
    enum: StatusOrcamentoVersao,
    enumName: 'status_orcamento_versao',
    default: StatusOrcamentoVersao.RASCUNHO,
  })
  status!: StatusOrcamentoVersao;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;
}