import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Natureza } from '../enums';

@Entity('recorrencias')
export class Recorrencia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ type: 'enum', enum: Natureza, enumName: 'natureza' })
  natureza!: Natureza;

  @Column({ type: 'text' })
  descricao!: string;

  @Column({ name: 'pessoa_id', type: 'uuid', nullable: true })
  pessoaId!: string | null;

  @Column({ name: 'categoria_id', type: 'uuid' })
  categoriaId!: string;

  @Column({ name: 'conta_bancaria_id', type: 'uuid', nullable: true })
  contaBancariaId!: string | null;

  @Column({ name: 'departamento_id', type: 'uuid', nullable: true })
  departamentoId!: string | null;

  @Column({ name: 'centro_custo_id', type: 'uuid', nullable: true })
  centroCustoId!: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  valor!: string;

  @Column({ type: 'text' })
  frequencia!: string;

  @Column({ name: 'dia_vencimento', type: 'smallint', nullable: true })
  diaVencimento!: number | null;

  @Column({ type: 'date' })
  inicio!: string;

  @Column({ type: 'date', nullable: true })
  fim!: string | null;

  @Column({ name: 'gerar_antecedencia_dias', type: 'smallint', default: 30 })
  gerarAntecedenciaDias!: number;

  @Column({ default: true })
  ativa!: boolean;
}