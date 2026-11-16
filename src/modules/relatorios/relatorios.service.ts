import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { fromMoney } from '../../common/utils/money';
import { TituloPagar } from '../../database/entities/titulo-pagar.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { StatusTitulo } from '../../database/enums';

@Injectable()
export class RelatoriosService {
  constructor(
    @InjectRepository(TituloReceber) private receberRepo: Repository<TituloReceber>,
    @InjectRepository(TituloPagar) private pagarRepo: Repository<TituloPagar>,
  ) {}

  async relatorioTitulosReceber(empresaId: string, de: string, ate: string) {
    const titulos = await this.receberRepo
      .createQueryBuilder('t')
      .where('t.empresa_id = :empresaId', { empresaId })
      .andWhere('t.data_vencimento >= :de', { de })
      .andWhere('t.data_vencimento <= :ate', { ate })
      .getMany();

    const totalOriginal = titulos.reduce((s, t) => s + fromMoney(t.valorOriginal), 0);
    const totalRecebido = titulos.reduce((s, t) => s + fromMoney(t.valorRecebido), 0);
    return {
      periodo: { de, ate },
      quantidade: titulos.length,
      total_original: totalOriginal,
      total_recebido: totalRecebido,
      saldo: totalOriginal - totalRecebido,
      titulos,
    };
  }

  async relatorioTitulosPagar(empresaId: string, de: string, ate: string) {
    const titulos = await this.pagarRepo
      .createQueryBuilder('t')
      .where('t.empresa_id = :empresaId', { empresaId })
      .andWhere('t.data_vencimento >= :de', { de })
      .andWhere('t.data_vencimento <= :ate', { ate })
      .getMany();

    const totalOriginal = titulos.reduce((s, t) => s + fromMoney(t.valorOriginal), 0);
    const totalPago = titulos.reduce((s, t) => s + fromMoney(t.valorPago), 0);
    return {
      periodo: { de, ate },
      quantidade: titulos.length,
      total_original: totalOriginal,
      total_pago: totalPago,
      saldo: totalOriginal - totalPago,
      titulos,
    };
  }

  async vencidos(empresaId: string) {
    const hoje = new Date().toISOString().slice(0, 10);
    const receber = await this.receberRepo
      .createQueryBuilder('t')
      .where('t.empresa_id = :empresaId', { empresaId })
      .andWhere('t.data_vencimento < :hoje', { hoje })
      .andWhere('t.status IN (:...st)', { st: [StatusTitulo.ABERTO, StatusTitulo.PARCIAL, StatusTitulo.VENCIDO] })
      .getMany();

    const pagar = await this.pagarRepo
      .createQueryBuilder('t')
      .where('t.empresa_id = :empresaId', { empresaId })
      .andWhere('t.data_vencimento < :hoje', { hoje })
      .andWhere('t.status IN (:...st)', { st: [StatusTitulo.ABERTO, StatusTitulo.PARCIAL, StatusTitulo.VENCIDO] })
      .getMany();

    return {
      referencia: hoje,
      titulos_receber: receber,
      titulos_pagar: pagar,
    };
  }
}