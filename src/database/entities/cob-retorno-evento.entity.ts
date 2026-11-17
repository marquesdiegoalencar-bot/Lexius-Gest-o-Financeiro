import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { StatusCobRetorno } from '../enums';

@Entity('cob_retorno_eventos')
export class CobRetornoEvento {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ name: 'tipo_evento', type: 'text' })
  tipoEvento!: string;

  @Column({ name: 'codigo_acordo', type: 'text', nullable: true })
  codigoAcordo!: string | null;

  @Column({ name: 'ordem_no_acordo', type: 'int', default: 0 })
  ordemNoAcordo!: number;

  @Column({ name: 'baixa_id', type: 'uuid', nullable: true })
  baixaId!: string | null;

  @Column({ name: 'titulo_receber_id', type: 'uuid', nullable: true })
  tituloReceberId!: string | null;

  @Column({ name: 'idempotency_key', type: 'text', unique: true })
  idempotencyKey!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: StatusCobRetorno,
    enumName: 'status_cob_retorno',
    default: StatusCobRetorno.PENDENTE,
  })
  status!: StatusCobRetorno;

  @Column({ type: 'smallint', default: 0 })
  tentativas!: number;

  @Column({ name: 'ultimo_erro', type: 'text', nullable: true })
  ultimoErro!: string | null;

  @Column({ name: 'http_status', type: 'smallint', nullable: true })
  httpStatus!: number | null;

  @Column({ name: 'enviado_em', type: 'timestamptz', nullable: true })
  enviadoEm!: Date | null;

  @CreateDateColumn({ name: 'criada_em', type: 'timestamptz' })
  criadaEm!: Date;
}