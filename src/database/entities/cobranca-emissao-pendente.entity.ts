import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ModalidadeCobranca } from '../enums';

@Entity('cobranca_emissao_pendente')
@Unique(['tituloReceberId', 'modalidade'])
export class CobrancaEmissaoPendente {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ name: 'titulo_receber_id', type: 'uuid' })
  tituloReceberId!: string;

  @Column({ name: 'conta_bancaria_id', type: 'uuid', nullable: true })
  contaBancariaId!: string | null;

  @Column({
    type: 'enum',
    enum: ModalidadeCobranca,
    enumName: 'modalidade_cobranca',
    default: ModalidadeCobranca.PIX_COBV,
  })
  modalidade!: ModalidadeCobranca;

  @Column({ name: 'ultimo_erro', type: 'text' })
  ultimoErro!: string;

  @Column({ type: 'smallint', default: 0 })
  tentativas!: number;

  @CreateDateColumn({ name: 'criada_em', type: 'timestamptz' })
  criadaEm!: Date;

  @Column({ name: 'resolvida_em', type: 'timestamptz', nullable: true })
  resolvidaEm!: Date | null;
}