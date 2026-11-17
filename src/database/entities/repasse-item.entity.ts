import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('repasse_itens')
export class RepasseItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'repasse_id', type: 'uuid' })
  repasseId!: string;

  @Column({ name: 'baixa_id', type: 'uuid', unique: true })
  baixaId!: string;

  @Column({ name: 'titulo_receber_id', type: 'uuid' })
  tituloReceberId!: string;

  @Column({ name: 'valor_recebido', type: 'numeric', precision: 14, scale: 2 })
  valorRecebido!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  comissao!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  honorarios!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  tarifa!: string;

  @Column({ name: 'valor_repasse', type: 'numeric', precision: 14, scale: 2 })
  valorRepasse!: string;
}