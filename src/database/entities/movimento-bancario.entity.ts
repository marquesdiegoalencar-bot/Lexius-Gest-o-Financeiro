import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { OrigemMovimento, SentidoMovimento } from '../enums';

@Entity('movimentos_bancarios')
@Unique(['contaBancariaId', 'idExterno'])
export class MovimentoBancario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conta_bancaria_id', type: 'uuid' })
  contaBancariaId!: string;

  @Column({ name: 'data_movimento', type: 'date' })
  dataMovimento!: string;

  @Column({ name: 'data_hora', type: 'timestamptz', nullable: true })
  dataHora!: Date | null;

  @Column({ type: 'enum', enum: SentidoMovimento, enumName: 'sentido_movimento' })
  sentido!: SentidoMovimento;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  valor!: string;

  @Column({ type: 'text', nullable: true })
  descricao!: string | null;

  @Column({ name: 'contraparte_nome', type: 'text', nullable: true })
  contraparteNome!: string | null;

  @Column({ name: 'contraparte_documento', type: 'varchar', length: 14, nullable: true })
  contraparteDocumento!: string | null;

  @Column({ name: 'tipo_transacao', type: 'text', nullable: true })
  tipoTransacao!: string | null;

  @Column({ type: 'enum', enum: OrigemMovimento, enumName: 'origem_movimento' })
  origem!: OrigemMovimento;

  @Column({ name: 'id_externo', type: 'text', nullable: true })
  idExterno!: string | null;

  @Column({ name: 'saldo_apos', type: 'numeric', precision: 14, scale: 2, nullable: true })
  saldoApos!: string | null;

  @Column({ default: false })
  conciliado!: boolean;

  @Column({ name: 'conciliado_em', type: 'timestamptz', nullable: true })
  conciliadoEm!: Date | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;
}