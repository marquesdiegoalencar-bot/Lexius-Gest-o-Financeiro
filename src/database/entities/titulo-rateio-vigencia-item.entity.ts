import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('titulo_rateio_vigencia_item')
export class TituloRateioVigenciaItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'vigencia_id', type: 'uuid' })
  vigenciaId!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ type: 'smallint' })
  linha!: number;

  @Column({ name: 'centro_custo_id', type: 'uuid', nullable: true })
  centroCustoId!: string | null;

  @Column({ name: 'departamento_id', type: 'uuid', nullable: true })
  departamentoId!: string | null;

  @Column({ type: 'numeric', precision: 9, scale: 4, nullable: true })
  percentual!: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  valor!: string | null;
}