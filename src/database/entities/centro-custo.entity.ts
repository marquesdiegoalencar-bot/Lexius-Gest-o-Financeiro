import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TipoCentroCusto } from '../enums';

@Entity('centros_custo')
@Unique(['empresaId', 'codigo'])
export class CentroCusto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  codigo!: string | null;

  @Column({ type: 'text' })
  nome!: string;

  @Column({ type: 'text', nullable: true })
  descricao!: string | null;

  @Column({
    type: 'enum',
    enum: TipoCentroCusto,
    enumName: 'tipo_centro_custo',
    default: TipoCentroCusto.ENTRADA,
  })
  tipo!: TipoCentroCusto;

  @Column({ default: true })
  ativo!: boolean;
}