import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TipoPessoa } from '../enums';

@Entity('pessoas')
@Index('idx_pessoas_documento', ['documento'])
export class Pessoa {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tipo_pessoa', type: 'enum', enum: TipoPessoa, enumName: 'tipo_pessoa' })
  tipoPessoa!: TipoPessoa;

  @Column({ type: 'text' })
  nome!: string;

  @Column({ type: 'varchar', length: 14, nullable: true })
  documento!: string | null;

  @Column({ type: 'text', nullable: true })
  email!: string | null;

  @Column({ type: 'text', nullable: true })
  telefone!: string | null;

  @Column({ name: 'eh_cliente', default: false })
  ehCliente!: boolean;

  @Column({ name: 'eh_fornecedor', default: false })
  ehFornecedor!: boolean;

  @Column({ name: 'eh_credor', default: false })
  ehCredor!: boolean;

  @Column({ name: 'eh_colaborador', default: false })
  ehColaborador!: boolean;

  @Column({ name: 'eh_advogado', default: false })
  ehAdvogado!: boolean;

  @Column({ name: 'cobranca_ref_id', type: 'text', nullable: true })
  cobrancaRefId!: string | null;

  @CreateDateColumn({ name: 'criada_em', type: 'timestamptz' })
  criadaEm!: Date;
}