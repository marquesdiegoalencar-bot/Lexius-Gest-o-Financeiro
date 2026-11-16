import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContaTarifaCobranca } from '../../database/entities/conta-tarifa-cobranca.entity';
import { FormaPagamento } from '../../database/enums';
import { fromMoney } from '../../common/utils/money';

@Injectable()
export class TarifasCobrancaService {
  constructor(
    @InjectRepository(ContaTarifaCobranca) private repo: Repository<ContaTarifaCobranca>,
  ) {}

  async valorTarifa(contaBancariaId: string, forma: FormaPagamento): Promise<number> {
    const row = await this.repo.findOne({ where: { contaBancariaId, forma } });
    return row ? fromMoney(row.valorTarifa) : 0;
  }

  async definirTarifa(contaBancariaId: string, forma: FormaPagamento, valor: number) {
    let row = await this.repo.findOne({ where: { contaBancariaId, forma } });
    if (!row) {
      row = this.repo.create({
        contaBancariaId,
        forma,
        valorTarifa: String(valor),
      });
    } else {
      row.valorTarifa = String(valor);
    }
    return this.repo.save(row);
  }

  listarPorConta(contaBancariaId: string) {
    return this.repo.find({ where: { contaBancariaId } });
  }
}