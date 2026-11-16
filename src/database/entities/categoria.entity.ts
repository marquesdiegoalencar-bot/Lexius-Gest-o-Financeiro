import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Natureza } from '../enums';

@Entity('categorias')
export class Categoria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid', nullable: true })
  empresaId!: string | null;

  @Column({ name: 'pai_id', type: 'uuid', nullable: true })
  paiId!: string | null;

  @Column({ type: 'text', nullable: true })
  codigo!: string | null;

  @Column({ type: 'text' })
  nome!: string;

  @Column({ type: 'enum', enum: Natureza, enumName: 'natureza' })
  natureza!: Natureza;

  @Column({ default: true })
  ativa!: boolean;
}