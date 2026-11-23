import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TipoContaBancaria } from '../enums';

@Entity('pessoa_dados_bancarios')
export class PessoaDadosBancarios {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'pessoa_id', type: 'uuid' })
  pessoaId!: string;

  @Column({ name: 'banco_codigo', type: 'varchar', length: 8, nullable: true })
  bancoCodigo!: string | null;

  @Column({ type: 'text', nullable: true })
  agencia!: string | null;

  @Column({ type: 'text', nullable: true })
  conta!: string | null;

  @Column({ name: 'tipo_conta', type: 'enum', enum: TipoContaBancaria, enumName: 'tipo_conta_bancaria', nullable: true })
  tipoConta!: TipoContaBancaria | null;

  @Column({ name: 'titular_nome', type: 'text' })
  titularNome!: string;

  @Column({ name: 'titular_documento', type: 'varchar', length: 14 })
  titularDocumento!: string;

  @Column({ name: 'chave_pix', type: 'text', nullable: true })
  chavePix!: string | null;

  @Column({ name: 'tipo_chave_pix', type: 'text', nullable: true })
  tipoChavePix!: string | null;

  @Column({ default: false })
  padrao!: boolean;

  @Column({ default: true })
  ativo!: boolean;
}