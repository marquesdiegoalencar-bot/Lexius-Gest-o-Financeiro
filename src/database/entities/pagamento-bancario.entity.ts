import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { StatusPagamentoBancario, TipoPagamentoBancario } from '../enums';

@Entity('pagamentos_bancarios')
export class PagamentoBancario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ name: 'conta_origem_id', type: 'uuid' })
  contaOrigemId!: string;

  @Column({ name: 'conta_destino_id', type: 'uuid', nullable: true })
  contaDestinoId!: string | null;

  @Column({ type: 'enum', enum: TipoPagamentoBancario, enumName: 'tipo_pagamento_bancario' })
  tipo!: TipoPagamentoBancario;

  @Column({ name: 'favorecido_nome', type: 'text', nullable: true })
  favorecidoNome!: string | null;

  @Column({ name: 'favorecido_documento', type: 'varchar', length: 14, nullable: true })
  favorecidoDocumento!: string | null;

  @Column({ name: 'dados_bancarios_id', type: 'uuid', nullable: true })
  dadosBancariosId!: string | null;

  @Column({ name: 'chave_pix', type: 'text', nullable: true })
  chavePix!: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  valor!: string;

  @Column({ name: 'data_pagamento', type: 'date' })
  dataPagamento!: string;

  @Column({ name: 'repasse_id', type: 'uuid', nullable: true })
  repasseId!: string | null;

  @Column({
    type: 'enum',
    enum: StatusPagamentoBancario,
    enumName: 'status_pagamento_bancario',
    default: StatusPagamentoBancario.RASCUNHO,
  })
  status!: StatusPagamentoBancario;

  @Column({ name: 'chave_idempotencia', type: 'uuid' })
  chaveIdempotencia!: string;

  @CreateDateColumn({ name: 'solicitado_em', type: 'timestamptz' })
  solicitadoEm!: Date;
}