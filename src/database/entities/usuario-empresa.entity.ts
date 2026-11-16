import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { PapelUsuario } from '../enums';
import { Empresa } from './empresa.entity';
import { Usuario } from './usuario.entity';

@Entity('usuario_empresa')
export class UsuarioEmpresa {
  @PrimaryColumn({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @PrimaryColumn({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ type: 'enum', enum: PapelUsuario, enumName: 'papel_usuario' })
  papel!: PapelUsuario;

  @ManyToOne(() => Usuario, (u) => u.empresas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @ManyToOne(() => Empresa, (e) => e.usuariosEmpresa, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empresa_id' })
  empresa!: Empresa;
}