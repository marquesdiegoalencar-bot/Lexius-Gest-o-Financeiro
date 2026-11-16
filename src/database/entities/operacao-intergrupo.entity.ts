import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('operacoes_intergrupo')
export class OperacaoIntergrupo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  descricao!: string;

  @Column({ name: 'empresa_credora_id', type: 'uuid' })
  empresaCredoraId!: string;

  @Column({ name: 'empresa_devedora_id', type: 'uuid' })
  empresaDevedoraId!: string;

  @Column({ name: 'titulo_receber_id', type: 'uuid', nullable: true })
  tituloReceberId!: string | null;

  @Column({ name: 'titulo_pagar_id', type: 'uuid', nullable: true })
  tituloPagarId!: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  valor!: string;

  @Column({ name: 'data_vencimento', type: 'date' })
  dataVencimento!: string;

  @Column({ name: 'criada_por', type: 'uuid', nullable: true })
  criadaPor!: string | null;

  @CreateDateColumn({ name: 'criada_em', type: 'timestamptz' })
  criadaEm!: Date;
}