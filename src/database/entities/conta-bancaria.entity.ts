import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ProvedorBancario, TipoContaBancaria } from '../enums';

@Entity('contas_bancarias')
@Unique(['empresaId', 'bancoCodigo', 'agencia', 'conta'])
export class ContaBancaria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ type: 'text' })
  apelido!: string;

  @Column({ name: 'banco_codigo', type: 'varchar', length: 3 })
  bancoCodigo!: string;

  @Column({ type: 'text', nullable: true })
  agencia!: string | null;

  @Column({ type: 'text', nullable: true })
  conta!: string | null;

  @Column({
    type: 'enum',
    enum: TipoContaBancaria,
    enumName: 'tipo_conta_bancaria',
    default: TipoContaBancaria.CORRENTE,
  })
  tipo!: TipoContaBancaria;

  @Column({
    type: 'enum',
    enum: ProvedorBancario,
    enumName: 'provedor_bancario',
    default: ProvedorBancario.MANUAL,
  })
  provedor!: ProvedorBancario;

  @Column({ name: 'conta_de_terceiros', default: false })
  contaDeTerceiros!: boolean;

  @Column({ name: 'saldo_inicial', type: 'numeric', precision: 14, scale: 2, default: 0 })
  saldoInicial!: string;

  @Column({ name: 'data_saldo_inicial', type: 'date', default: () => 'CURRENT_DATE' })
  dataSaldoInicial!: string;

  @Column({ name: 'saldo_banco', type: 'numeric', precision: 14, scale: 2, nullable: true })
  saldoBanco!: string | null;

  @Column({ name: 'saldo_banco_em', type: 'timestamptz', nullable: true })
  saldoBancoEm!: Date | null;

  @Column({ name: 'credencial_ref', type: 'text', nullable: true })
  credencialRef!: string | null;

  @Column({ name: 'sincroniza_extrato', default: false })
  sincronizaExtrato!: boolean;

  @Column({ name: 'ultima_sincronizacao', type: 'timestamptz', nullable: true })
  ultimaSincronizacao!: Date | null;

  @Column({ default: true })
  ativa!: boolean;
}