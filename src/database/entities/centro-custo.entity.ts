import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('centros_custo')
export class CentroCusto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ type: 'text' })
  nome!: string;

  @Column({ default: true })
  ativo!: boolean;
}