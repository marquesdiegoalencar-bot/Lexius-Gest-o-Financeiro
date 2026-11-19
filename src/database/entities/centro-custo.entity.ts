import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TipoCentroCusto, TipoNoCentroCusto } from '../enums';

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

  @Column({ name: 'pai_id', type: 'uuid', nullable: true })
  paiId!: string | null;

  @ManyToOne(() => CentroCusto, { nullable: true })
  @JoinColumn({ name: 'pai_id' })
  pai?: CentroCusto | null;

  @Column({
    name: 'tipo_no',
    type: 'enum',
    enum: TipoNoCentroCusto,
    enumName: 'tipo_no_centro_custo',
  })
  tipoNo!: TipoNoCentroCusto;

  @Column({ default: true })
  ativo!: boolean;
}