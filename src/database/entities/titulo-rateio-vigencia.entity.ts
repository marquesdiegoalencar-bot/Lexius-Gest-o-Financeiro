import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ModoRateio, OrigemTituloRateioVigencia } from '../enums';

@Entity('titulo_rateio_vigencia')
export class TituloRateioVigencia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'empresa_id', type: 'uuid' })
  empresaId!: string;

  @Column({ name: 'titulo_receber_id', type: 'uuid', nullable: true })
  tituloReceberId!: string | null;

  @Column({ name: 'titulo_pagar_id', type: 'uuid', nullable: true })
  tituloPagarId!: string | null;

  @Column({ name: 'definicao_id', type: 'uuid', nullable: true })
  definicaoId!: string | null;

  @Column({
    type: 'enum',
    enum: OrigemTituloRateioVigencia,
    enumName: 'origem_titulo_rateio_vigencia',
  })
  origem!: OrigemTituloRateioVigencia;

  @Column({ type: 'enum', enum: ModoRateio, enumName: 'modo_rateio', default: ModoRateio.PERCENTUAL })
  modo!: ModoRateio;

  @Column({ name: 'valido_de', type: 'timestamptz' })
  validoDe!: Date;

  @Column({ name: 'valido_ate', type: 'timestamptz', nullable: true })
  validoAte!: Date | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;
}