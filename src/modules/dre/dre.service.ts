import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { distribuirValorPorRateio, LinhaRateioDistribuicao } from '../../common/financeiro/rateio-distribuicao';
import {
  competenciaParaInstante,
  FUSO_NEGOCIO_PADRAO,
} from '../../common/financeiro/fuso-negocio';
import { fromMoney, roundMoney } from '../../common/utils/money';
import { BaixaAlocacaoItem } from '../../database/entities/baixa-alocacao-item.entity';
import { Categoria } from '../../database/entities/categoria.entity';
import { Empresa } from '../../database/entities/empresa.entity';
import { TituloRateioVigencia } from '../../database/entities/titulo-rateio-vigencia.entity';
import { TituloRateioVigenciaItem } from '../../database/entities/titulo-rateio-vigencia-item.entity';
import { ModoRateio, Natureza } from '../../database/enums';
import { FiltroDreDto } from './dto/filtro-dre.dto';

export type DreLinha = {
  categoria_id: string;
  categoria_nome: string;
  natureza: Natureza;
  centro_custo_id: string | null;
  departamento_id: string | null;
  valor: number;
};

export type DreAvisosCompetencia = {
  titulos_sem_classificacao_temporal: {
    quantidade: number;
    valor_excluido: number;
  };
};

@Injectable()
export class DreService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(BaixaAlocacaoItem) private baixaItens: Repository<BaixaAlocacaoItem>,
    @InjectRepository(Categoria) private categorias: Repository<Categoria>,
    @InjectRepository(TituloRateioVigencia) private vigencias: Repository<TituloRateioVigencia>,
    @InjectRepository(TituloRateioVigenciaItem) private vigenciaItens: Repository<TituloRateioVigenciaItem>,
    @InjectRepository(Empresa) private empresas: Repository<Empresa>,
  ) {}

  async porCompetencia(empresaId: string, filtros: FiltroDreDto) {
    const fuso = await this.fusoEmpresa(empresaId);
    const { linhas, avisos } = await this.aggTitulosCompetencia(empresaId, filtros, fuso);
    return this.montarResposta('competencia', filtros, linhas, avisos);
  }

  async porCaixa(empresaId: string, filtros: FiltroDreDto) {
    const qb = this.baixaItens
      .createQueryBuilder('a')
      .innerJoin('baixas', 'b', 'b.id = a.baixa_id')
      .leftJoin('titulos_receber', 'tr', 'tr.id = b.titulo_receber_id')
      .leftJoin('titulos_pagar', 'tp', 'tp.id = b.titulo_pagar_id')
      .innerJoin('categorias', 'c', 'c.id = COALESCE(tr.categoria_id, tp.categoria_id)')
      .where('a.empresa_id = :empresaId', { empresaId })
      .andWhere('b.estornada = FALSE')
      .andWhere('b.data_baixa >= :de', { de: filtros.de })
      .andWhere('b.data_baixa <= :ate', { ate: filtros.ate });

    if (filtros.natureza) qb.andWhere('c.natureza = :natureza', { natureza: filtros.natureza });
    if (filtros.categoria_id) qb.andWhere('c.id = :categoriaId', { categoriaId: filtros.categoria_id });
    if (filtros.centro_custo_id) {
      qb.andWhere('a.centro_custo_id = :cc', { cc: filtros.centro_custo_id });
    }
    if (filtros.departamento_id) {
      qb.andWhere('a.departamento_id = :dep', { dep: filtros.departamento_id });
    }

    const rows = await qb
      .select([
        'c.id AS categoria_id',
        'c.nome AS categoria_nome',
        'c.natureza AS natureza',
        'a.centro_custo_id AS centro_custo_id',
        'a.departamento_id AS departamento_id',
        'SUM(a.valor::numeric) AS total',
      ])
      .groupBy('c.id, c.nome, c.natureza, a.centro_custo_id, a.departamento_id')
      .getRawMany<{
        categoria_id: string;
        categoria_nome: string;
        natureza: Natureza;
        centro_custo_id: string | null;
        departamento_id: string | null;
        total: string;
      }>();

    const linhas: DreLinha[] = rows.map((r) => ({
      categoria_id: r.categoria_id,
      categoria_nome: r.categoria_nome,
      natureza: r.natureza,
      centro_custo_id: r.centro_custo_id,
      departamento_id: r.departamento_id,
      valor: roundMoney(Number(r.total)),
    }));

    return this.montarResposta('caixa', filtros, linhas);
  }

  /** Exposto para orçamento — somente competência agregada. */
  async linhasCompetencia(empresaId: string, filtros: FiltroDreDto): Promise<DreLinha[]> {
    const fuso = await this.fusoEmpresa(empresaId);
    const { linhas } = await this.aggTitulosCompetencia(empresaId, filtros, fuso);
    return linhas;
  }

  private async fusoEmpresa(empresaId: string): Promise<string> {
    const e = await this.empresas.findOne({ where: { id: empresaId } });
    return e?.fusoNegocio ?? FUSO_NEGOCIO_PADRAO;
  }

  private async aggTitulosCompetencia(
    empresaId: string,
    filtros: FiltroDreDto,
    fuso: string,
  ): Promise<{ linhas: DreLinha[]; avisos: DreAvisosCompetencia }> {
    const params: unknown[] = [empresaId, filtros.de, filtros.ate];

    const sql = `
      SELECT t.id, t.empresa_id, 'RECEBER' AS lado,
             t.categoria_id, t.centro_custo_id, t.departamento_id,
             t.data_competencia, t.data_emissao,
             (t.valor_original - t.desconto + t.juros + t.multa) AS valor_base
      FROM titulos_receber t
      WHERE t.empresa_id = $1
        AND t.status NOT IN ('CANCELADO')
        AND COALESCE(t.data_competencia, t.data_emissao) IS NOT NULL
        AND COALESCE(t.data_competencia, t.data_emissao) >= $2
        AND COALESCE(t.data_competencia, t.data_emissao) <= $3
      UNION ALL
      SELECT t.id, t.empresa_id, 'PAGAR' AS lado,
             t.categoria_id, t.centro_custo_id, t.departamento_id,
             t.data_competencia, t.data_emissao,
             (t.valor_original - t.desconto + t.juros + t.multa) AS valor_base
      FROM titulos_pagar t
      WHERE t.empresa_id = $1
        AND t.status NOT IN ('CANCELADO')
        AND COALESCE(t.data_competencia, t.data_emissao) IS NOT NULL
        AND COALESCE(t.data_competencia, t.data_emissao) >= $2
        AND COALESCE(t.data_competencia, t.data_emissao) <= $3
    `;

    const pendSql = `
      SELECT COUNT(*)::int AS quantidade,
             COALESCE(SUM((valor_original - desconto + juros + multa)::numeric), 0) AS valor
      FROM (
        SELECT valor_original, desconto, juros, multa
        FROM titulos_receber t
        WHERE t.empresa_id = $1
          AND t.status NOT IN ('CANCELADO')
          AND t.data_competencia IS NULL
          AND t.data_emissao IS NULL
        UNION ALL
        SELECT valor_original, desconto, juros, multa
        FROM titulos_pagar t
        WHERE t.empresa_id = $1
          AND t.status NOT IN ('CANCELADO')
          AND t.data_competencia IS NULL
          AND t.data_emissao IS NULL
      ) x
    `;

    const [titulos, pendRows] = await Promise.all([
      this.dataSource.query(sql, params),
      this.dataSource.query(pendSql, [empresaId]),
    ]);

    const avisos: DreAvisosCompetencia = {
      titulos_sem_classificacao_temporal: {
        quantidade: pendRows[0]?.quantidade ?? 0,
        valor_excluido: roundMoney(fromMoney(pendRows[0]?.valor ?? 0)),
      },
    };

    const catIds = [...new Set(titulos.map((t: { categoria_id: string }) => t.categoria_id))];
    const cats = catIds.length ? await this.categorias.find({ where: { id: In(catIds) } }) : [];
    const catMap = new Map(cats.map((c) => [c.id, c]));

    const acc = new Map<string, DreLinha>();

    for (const t of titulos as {
      id: string;
      lado: string;
      categoria_id: string;
      centro_custo_id: string | null;
      departamento_id: string | null;
      data_competencia: string | Date | null;
      data_emissao: string | Date | null;
      valor_base: string;
    }[]) {
      const cat = catMap.get(t.categoria_id);
      if (!cat) continue;
      if (filtros.natureza && cat.natureza !== filtros.natureza) continue;
      if (filtros.categoria_id && cat.id !== filtros.categoria_id) continue;

      const valorBase = fromMoney(t.valor_base);
      const bruto = t.data_competencia ?? t.data_emissao;
      const dataRef =
        typeof bruto === 'string'
          ? bruto.slice(0, 10)
          : bruto instanceof Date
            ? bruto.toISOString().slice(0, 10)
            : String(bruto).slice(0, 10);
      const instante = new Date(competenciaParaInstante(dataRef, fuso));

      const vigencia = await this.vigencias
        .createQueryBuilder('v')
        .where('v.empresa_id = :empresaId', { empresaId })
        .andWhere(
          t.lado === 'RECEBER' ? 'v.titulo_receber_id = :tid' : 'v.titulo_pagar_id = :tid',
          { tid: t.id },
        )
        .andWhere('v.valido_de <= :inst', { inst: instante })
        .andWhere('(v.valido_ate IS NULL OR v.valido_ate > :inst)', { inst: instante })
        .orderBy('v.valido_de', 'DESC')
        .getOne();

      let linhasRateio: LinhaRateioDistribuicao[];
      let modo = ModoRateio.PERCENTUAL;

      if (vigencia) {
        modo = vigencia.modo;
        const itens = await this.vigenciaItens.find({
          where: { vigenciaId: vigencia.id },
          order: { linha: 'ASC' },
        });
        linhasRateio = itens.map((i) => ({
          linha: i.linha,
          centro_custo_id: i.centroCustoId,
          departamento_id: i.departamentoId,
          percentual: i.percentual != null ? Number(i.percentual) : null,
          valor: i.valor != null ? fromMoney(i.valor) : null,
        }));
      } else if (t.centro_custo_id || t.departamento_id) {
        linhasRateio = [
          {
            linha: 1,
            centro_custo_id: t.centro_custo_id,
            departamento_id: t.departamento_id,
            percentual: 100,
          },
        ];
      } else {
        linhasRateio = [
          {
            linha: 1,
            centro_custo_id: null,
            departamento_id: null,
            percentual: 100,
          },
        ];
      }

      const partes = distribuirValorPorRateio(valorBase, modo, linhasRateio);
      for (const p of partes) {
        const orig = linhasRateio.find((l) => l.linha === p.linha);
        const cc = orig?.centro_custo_id ?? null;
        const dep = orig?.departamento_id ?? null;
        if (filtros.centro_custo_id && cc !== filtros.centro_custo_id) continue;
        if (filtros.departamento_id && dep !== filtros.departamento_id) continue;

        const key = `${cat.id}|${cc ?? ''}|${dep ?? ''}`;
        const atual = acc.get(key) ?? {
          categoria_id: cat.id,
          categoria_nome: cat.nome,
          natureza: cat.natureza,
          centro_custo_id: cc,
          departamento_id: dep,
          valor: 0,
        };
        atual.valor = roundMoney(atual.valor + fromMoney(p.valor));
        acc.set(key, atual);
      }
    }

    return { linhas: [...acc.values()], avisos };
  }

  private montarResposta(
    modalidade: 'competencia' | 'caixa',
    filtros: FiltroDreDto,
    linhas: DreLinha[],
    avisos?: DreAvisosCompetencia,
  ) {
    const receitas = roundMoney(
      linhas.filter((l) => l.natureza === Natureza.RECEITA).reduce((s, l) => s + l.valor, 0),
    );
    const despesas = roundMoney(
      linhas.filter((l) => l.natureza === Natureza.DESPESA).reduce((s, l) => s + l.valor, 0),
    );
    return {
      modalidade,
      periodo: { de: filtros.de, ate: filtros.ate },
      filtros: {
        natureza: filtros.natureza ?? null,
        categoria_id: filtros.categoria_id ?? null,
        centro_custo_id: filtros.centro_custo_id ?? null,
        departamento_id: filtros.departamento_id ?? null,
      },
      totais: {
        receitas,
        despesas,
        resultado: roundMoney(receitas - despesas),
      },
      linhas,
      ...(avisos ? { avisos } : {}),
    };
  }
}