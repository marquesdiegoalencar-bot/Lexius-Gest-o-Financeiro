import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { FormaPagamento, OrigemTitulo, StatusTitulo } from '../enums';

@Entity('titulos_receber')
@Unique(['empresaId', 'cobrancaParcelaId'])
export class TituloReceber {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ type: 'text', nullable: true })
  numero!: string | null;

  @Column({ type: 'text' })
  descricao!: string;

  @Column({ name: 'pessoa_id', type: 'uuid', nullable: true })
  pessoaId!: string | null;

  @Column({ name: 'credor_id', type: 'uuid', nullable: true })
  credorId!: string | null;

  @Column({ name: 'categoria_id', type: 'uuid' })
  categoriaId!: string;

  @Column({ name: 'centro_custo_id', type: 'uuid', nullable: true })
  centroCustoId!: string | null;

  @Column({ name: 'departamento_id', type: 'uuid', nullable: true })
  departamentoId!: string | null;

  @Column({ name: 'conta_bancaria_id', type: 'uuid', nullable: true })
  contaBancariaId!: string | null;

  @Column({ type: 'enum', enum: OrigemTitulo, enumName: 'origem_titulo', default: OrigemTitulo.MANUAL })
  origem!: OrigemTitulo;

  @Column({ name: 'acordo_id', type: 'uuid', nullable: true })
  acordoId!: string | null;

  @Column({ name: 'cobranca_acordo_id', type: 'text', nullable: true })
  cobrancaAcordoId!: string | null;

  @Column({ name: 'cobranca_parcela_id', type: 'text', nullable: true })
  cobrancaParcelaId!: string | null;

  @Column({ name: 'tipo_parcela', type: 'text', default: 'AVULSO' })
  tipoParcela!: string;

  @Column({ name: 'parcela_numero', type: 'smallint', default: 1 })
  parcelaNumero!: number;

  @Column({ name: 'parcela_total', type: 'smallint', default: 1 })
  parcelaTotal!: number;

  @Column({ name: 'grupo_parcelas_id', type: 'uuid', nullable: true })
  grupoParcelasId!: string | null;

  @Column({ name: 'recorrencia_id', type: 'uuid', nullable: true })
  recorrenciaId!: string | null;

  @Column({ name: 'valor_original', type: 'numeric', precision: 14, scale: 2 })
  valorOriginal!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  desconto!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  juros!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  multa!: string;

  @Column({ name: 'valor_recebido', type: 'numeric', precision: 14, scale: 2, default: 0 })
  valorRecebido!: string;

  @Column({ name: 'data_emissao', type: 'date', default: () => 'CURRENT_DATE' })
  dataEmissao!: string;

  @Column({ name: 'data_vencimento', type: 'date' })
  dataVencimento!: string;

  @Column({ name: 'data_competencia', type: 'date', nullable: true })
  dataCompetencia!: string | null;

  @Column({ name: 'data_pagamento', type: 'date', nullable: true })
  dataPagamento!: string | null;

  @Column({ type: 'enum', enum: StatusTitulo, enumName: 'status_titulo', default: StatusTitulo.ABERTO })
  status!: StatusTitulo;

  @Column({ name: 'forma_prevista', type: 'enum', enum: FormaPagamento, enumName: 'forma_pagamento', nullable: true })
  formaPrevista!: FormaPagamento | null;

  @Column({ type: 'text', nullable: true })
  observacao!: string | null;

  @Column({ name: 'criado_por', type: 'uuid', nullable: true })
  criadoPor!: string | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;
}