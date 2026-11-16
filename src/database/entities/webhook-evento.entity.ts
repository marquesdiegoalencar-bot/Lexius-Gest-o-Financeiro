import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ProvedorBancario } from '../enums';

@Entity('webhook_eventos')
@Unique(['provedor', 'eventoIdExterno'])
export class WebhookEvento {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ProvedorBancario, enumName: 'provedor_bancario' })
  provedor!: ProvedorBancario;

  @Column({ name: 'evento_id_externo', type: 'text', nullable: true })
  eventoIdExterno!: string | null;

  @Column({ name: 'tipo_evento', type: 'text' })
  tipoEvento!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'assinatura_valida', type: 'boolean', nullable: true })
  assinaturaValida!: boolean | null;

  @Column({ default: false })
  processado!: boolean;

  @Column({ name: 'processado_em', type: 'timestamptz', nullable: true })
  processadoEm!: Date | null;

  @Column({ type: 'smallint', default: 0 })
  tentativas!: number;

  @Column({ type: 'text', nullable: true })
  erro!: string | null;

  @Column({ name: 'revisao_manual', default: false })
  revisaoManual!: boolean;

  @CreateDateColumn({ name: 'recebido_em', type: 'timestamptz' })
  recebidoEm!: Date;
}