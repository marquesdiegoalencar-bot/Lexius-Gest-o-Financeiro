import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ProvedorBancario, StatusCobranca } from '../enums';

@Entity('cobrancas_boleto')
@Unique(['provedor', 'idExterno'])
export class CobrancaBoleto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ name: 'titulo_receber_id', type: 'uuid' })
  tituloReceberId!: string;

  @Column({ name: 'conta_bancaria_id', type: 'uuid' })
  contaBancariaId!: string;

  @Column({ type: 'enum', enum: ProvedorBancario, enumName: 'provedor_bancario' })
  provedor!: ProvedorBancario;

  @Column({ name: 'id_externo', type: 'text', nullable: true })
  idExterno!: string | null;

  @Column({ name: 'nosso_numero', type: 'text', nullable: true })
  nossoNumero!: string | null;

  @Column({ name: 'linha_digitavel', type: 'text', nullable: true })
  linhaDigitavel!: string | null;

  @Column({ name: 'codigo_barras', type: 'text', nullable: true })
  codigoBarras!: string | null;

  @Column({ name: 'pix_copia_cola', type: 'text', nullable: true })
  pixCopiaCola!: string | null;

  @Column({ type: 'text', nullable: true })
  txid!: string | null;

  @Column({ name: 'url_pdf', type: 'text', nullable: true })
  urlPdf!: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  valor!: string;

  @Column({ name: 'data_vencimento', type: 'date' })
  dataVencimento!: string;

  @Column({
    type: 'enum',
    enum: StatusCobranca,
    enumName: 'status_cobranca',
    default: StatusCobranca.EMITIDA,
  })
  status!: StatusCobranca;

  @Column({ name: 'pago_em', type: 'timestamptz', nullable: true })
  pagoEm!: Date | null;

  @Column({ name: 'valor_pago', type: 'numeric', precision: 14, scale: 2, nullable: true })
  valorPago!: string | null;

  @Column({ name: 'erro_mensagem', type: 'text', nullable: true })
  erroMensagem!: string | null;

  @CreateDateColumn({ name: 'criada_em', type: 'timestamptz' })
  criadaEm!: Date;
}