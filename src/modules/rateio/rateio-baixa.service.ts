import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { distribuirValorPorRateio, LinhaRateioDistribuicao } from '../../common/financeiro/rateio-distribuicao';
import { fromMoney } from '../../common/utils/money';
import { Baixa } from '../../database/entities/baixa.entity';
import { BaixaAlocacaoItem } from '../../database/entities/baixa-alocacao-item.entity';
import { TituloPagar } from '../../database/entities/titulo-pagar.entity';
import { TituloRateioVigenciaItem } from '../../database/entities/titulo-rateio-vigencia-item.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { ModoRateio, TipoBaixaAlocacao } from '../../database/enums';
import { RateioService } from './rateio.service';

@Injectable()
export class RateioBaixaService {
  constructor(private rateio: RateioService) {}

  async criarAposBaixa(
    manager: EntityManager,
    baixa: Baixa,
    titulo: TituloReceber | TituloPagar,
  ): Promise<BaixaAlocacaoItem[]> {
    const existente = await manager.count(BaixaAlocacaoItem, {
      where: { baixaId: baixa.id, tipo: TipoBaixaAlocacao.BAIXA },
    });
    if (existente > 0) return [];

    const valorLiquido = fromMoney(baixa.valorLiquido);
    const isReceber = !!baixa.tituloReceberId;
    const tituloReceber = isReceber ? (titulo as TituloReceber) : null;
    const tituloPagar = !isReceber ? (titulo as TituloPagar) : null;

    const vigencia = await this.rateio.vigenciaVigenteNaData(
      manager,
      baixa.empresaId,
      isReceber
        ? { receberId: tituloReceber!.id }
        : { pagarId: tituloPagar!.id },
      baixa.dataBaixa,
    );

  let linhas: LinhaRateioDistribuicao[] = [];
    let modo = ModoRateio.PERCENTUAL;
    let vigenciaId: string | null = null;

    if (vigencia) {
      vigenciaId = vigencia.id;
      modo = vigencia.modo;
      const itensVig = await manager.find(TituloRateioVigenciaItem, {
        where: { vigenciaId: vigencia.id },
        order: { linha: 'ASC' },
      });
      linhas = itensVig.map((i) => ({
        linha: i.linha,
        centro_custo_id: i.centroCustoId,
        departamento_id: i.departamentoId,
        percentual: i.percentual != null ? Number(i.percentual) : null,
        valor: i.valor != null ? fromMoney(i.valor) : null,
      }));
    } else if (tituloReceber?.centroCustoId || tituloReceber?.departamentoId) {
      linhas = [
        {
          linha: 1,
          centro_custo_id: tituloReceber.centroCustoId,
          departamento_id: tituloReceber.departamentoId,
          percentual: 100,
        },
      ];
    } else if (tituloPagar?.centroCustoId || tituloPagar?.departamentoId) {
      linhas = [
        {
          linha: 1,
          centro_custo_id: tituloPagar.centroCustoId,
          departamento_id: tituloPagar.departamentoId,
          percentual: 100,
        },
      ];
    } else {
      return [];
    }

    const partes = distribuirValorPorRateio(valorLiquido, modo, linhas);
    const mapaLinha = new Map(linhas.map((l) => [l.linha, l]));
    const entities: BaixaAlocacaoItem[] = [];

    for (const p of partes) {
      const orig = mapaLinha.get(p.linha);
      entities.push(
        manager.create(BaixaAlocacaoItem, {
          empresaId: baixa.empresaId,
          baixaId: baixa.id,
          tipo: TipoBaixaAlocacao.BAIXA,
          linha: p.linha,
          centroCustoId: orig?.centro_custo_id ?? null,
          departamentoId: orig?.departamento_id ?? null,
          valor: p.valor,
          percentualRef: p.percentual_ref,
          vigenciaId,
        }),
      );
    }

    return manager.save(entities);
  }

  async criarEstornoAlocacao(manager: EntityManager, baixa: Baixa): Promise<BaixaAlocacaoItem[]> {
    const originais = await manager.find(BaixaAlocacaoItem, {
      where: { baixaId: baixa.id, tipo: TipoBaixaAlocacao.BAIXA },
      order: { linha: 'ASC' },
    });
    if (!originais.length) return [];

    const jaEstorno = await manager.count(BaixaAlocacaoItem, {
      where: { baixaId: baixa.id, tipo: TipoBaixaAlocacao.ESTORNO },
    });
    if (jaEstorno > 0) return [];

    const linhas: BaixaAlocacaoItem[] = originais.map((o) =>
      manager.create(BaixaAlocacaoItem, {
        empresaId: baixa.empresaId,
        baixaId: baixa.id,
        tipo: TipoBaixaAlocacao.ESTORNO,
        linha: o.linha,
        centroCustoId: o.centroCustoId,
        departamentoId: o.departamentoId,
        valor: (-fromMoney(o.valor)).toFixed(2),
        percentualRef: o.percentualRef,
        vigenciaId: o.vigenciaId,
        estornoDeId: o.id,
      }),
    );
    return manager.save(linhas);
  }
}