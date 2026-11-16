import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UsuarioEmpresa } from './usuario-empresa.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  nome!: string;

  @Column({ type: 'text', unique: true })
  email!: string;

  @Column({ name: 'cobranca_user_id', type: 'text', nullable: true })
  cobrancaUserId!: string | null;

  @Column({ name: 'mfa_ativo', default: false })
  mfaAtivo!: boolean;

  @Column({ default: true })
  ativo!: boolean;

  /** Hash bcrypt — não expor na API */
  @Column({ name: 'senha_hash', type: 'text', select: false, nullable: true })
  senhaHash!: string | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  @OneToMany(() => UsuarioEmpresa, (ue) => ue.usuario)
  empresas?: UsuarioEmpresa[];
}