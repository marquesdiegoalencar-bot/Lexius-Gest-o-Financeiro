import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('anexos')
@Index(['entidade', 'entidadeId'])
export class Anexo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ type: 'text' })
  entidade!: string;

  @Column({ name: 'entidade_id', type: 'uuid' })
  entidadeId!: string;

  @Column({ type: 'text', default: 'COMPROVANTE' })
  tipo!: string;

  @Column({ name: 'nome_arquivo', type: 'text' })
  nomeArquivo!: string;

  @Column({ name: 'mime_type', type: 'text' })
  mimeType!: string;

  @Column({ name: 'tamanho_bytes', type: 'bigint' })
  tamanhoBytes!: string;

  @Column({ name: 'hash_sha256', type: 'text' })
  hashSha256!: string;

  @Column({ name: 'storage_chave', type: 'text' })
  storageChave!: string;

  @Column({ name: 'enviado_por', type: 'uuid', nullable: true })
  enviadoPor!: string | null;

  @CreateDateColumn({ name: 'enviado_em', type: 'timestamptz' })
  enviadoEm!: Date;
}