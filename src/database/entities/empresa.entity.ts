import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoEmpresa } from '../enums';
import { UsuarioEmpresa } from './usuario-empresa.entity';

@Entity('empresas')
export class Empresa {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: TipoEmpresa, enumName: 'tipo_empresa' })
  tipo!: TipoEmpresa;

  @Column({ name: 'razao_social', type: 'text' })
  razaoSocial!: string;

  @Column({ name: 'nome_fantasia', type: 'text', nullable: true })
  nomeFantasia!: string | null;

  @Column({ type: 'varchar', length: 14, unique: true })
  cnpj!: string;

  @Column({ default: true })
  ativa!: boolean;

  @Column({ name: 'fuso_negocio', type: 'text', default: 'America/Manaus' })
  fusoNegocio!: string;

  @CreateDateColumn({ name: 'criada_em', type: 'timestamptz' })
  criadaEm!: Date;

  @OneToMany(() => UsuarioEmpresa, (ue) => ue.empresa)
  usuariosEmpresa?: UsuarioEmpresa[];
}