import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ModoRateio, StatusTituloAlocacao } from '../enums';

@Entity('titulo_alocacao_definicao')
export class TituloAlocacaoDefinicao {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ name: 'titulo_receber_id', type: 'uuid', nullable: true })
  tituloReceberId!: string | null;

  @Column({ name: 'titulo_pagar_id', type: 'uuid', nullable: true })
  tituloPagarId!: string | null;

  @Column({ type: 'enum', enum: ModoRateio, enumName: 'modo_rateio', default: ModoRateio.PERCENTUAL })
  modo!: ModoRateio;

  @Column({
    type: 'enum',
    enum: StatusTituloAlocacao,
    enumName: 'status_titulo_alocacao',
    default: StatusTituloAlocacao.RASCUNHO,
  })
  status!: StatusTituloAlocacao;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;
}