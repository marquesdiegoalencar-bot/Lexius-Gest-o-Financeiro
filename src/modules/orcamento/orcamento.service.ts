import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { FinanceiroDimensoesService } from '../../common/financeiro/financeiro-dimensoes.service';
import { fromMoney, roundMoney, toMoneyString } from '../../common/utils/money';
import { Categoria } from '../../database/entities/categoria.entity';
import { OrcamentoItem } from '../../database/entities/orcamento-item.entity';
import { OrcamentoVersao } from '../../database/entities/orcamento-versao.entity';
import { StatusOrcamentoVersao } from '../../database/enums';
import { DreService } from '../dre/dre.service';
import { CreateOrcamentoVersaoDto } from './dto/create-orcamento-versao.dto';
import { SalvarOrcamentoItensDto } from './dto/salvar-orcamento-itens.dto';

@Injectable()
export class OrcamentoService {
  constructor(
    private dataSource: DataSource,
    private dre: DreService,
    private financeiroDimensoes: FinanceiroDimensoesService,
    @InjectRepository(OrcamentoVersao) private versoes: Repository<OrcamentoVersao>,
    @InjectRepository(OrcamentoItem) private itens: Repository<OrcamentoItem>,
    @InjectRepository(Categoria) private categorias: Repository<Categoria>,
  ) {}

  async listVersoes(empresaId: string, ano?: number, mes?: number) {
    const qb = this.versoes
      .createQueryBuilder('v')
      .where('v.empresa_id = :empresaId', { empresaId })
      .orderBy('v.ano', 'DESC')
      .addOrderBy('v.mes', 'DESC');
    if (ano) qb.andWhere('v.ano = :ano', { ano });
    if (mes) qb.andWhere('v.mes = :mes', { mes });
    return qb.getMany();
  }

  async criarVersao(empresaId: string, dto: CreateOrcamentoVersaoDto) {
    const entity = this.versoes.create({
      empresaId,
      ano: dto.ano,
      mes: dto.mes,
      nome: dto.nome?.trim() || null,
      status: StatusOrcamentoVersao.RASCUNHO,
    });
    try {
      return await this.versoes.save(entity);
    } catch {
      throw new ConflictException('Já existe versão de orçamento para este período/nome');
    }
  }

  async obterVersao(versaoId: string, empresaId: string) {
    const v = await this.versoes.findOne({ where: { id: versaoId, empresaId } });
    if (!v) throw new NotFoundException('Versão de orçamento não encontrada');
    const linhas = await this.itens.find({ where: { versaoId }, order: { categoriaId: 'ASC' } });
    return { versao: v, itens: linhas };
  }

  async salvarItensFolha(versaoId: string, empresaId: string, dto: SalvarOrcamentoItensDto) {
    return this.dataSource.transaction(async (manager) => {
      const versao = await manager.findOne(OrcamentoVersao, {
        where: { id: versaoId, empresaId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!versao) throw new NotFoundException('Versão de orçamento não encontrada');
      if (versao.status !== StatusOrcamentoVersao.RASCUNHO) {
        throw new ConflictException('Somente versões em rascunho podem ser editadas');
      }

      for (const item of dto.itens) {
        await this.assertCategoriaFolha(empresaId, item.categoria_id);
        await this.financeiroDimensoes.assertNovosVinculosTx(manager, empresaId, {
          centro_custo_id: item.centro_custo_id,
          departamento_id: item.departamento_id,
        });
      }

      await manager.delete(OrcamentoItem, { versaoId });
      const persistidos = dto.itens.map((i) =>
        manager.create(OrcamentoItem, {
          versaoId,
          empresaId,
          categoriaId: i.categoria_id,
          centroCustoId: i.centro_custo_id ?? null,
          departamentoId: i.departamento_id ?? null,
          valorPrevisto: toMoneyString(i.valor_previsto),
        }),
      );
      await manager.save(persistidos);
      versao.atualizadoEm = new Date();
      await manager.save(versao);
      return { versao, itens: persistidos };
    });
  }

  async aprovarVersao(versaoId: string, empresaId: string) {
    return this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(OrcamentoVersao, {
        where: { id: versaoId, empresaId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Versão de orçamento não encontrada');
      if (locked.status !== StatusOrcamentoVersao.RASCUNHO) {
        throw new ConflictException('Somente rascunhos podem ser aprovados');
      }
      const itensCount = await manager.count(OrcamentoItem, { where: { versaoId } });
      if (itensCount === 0) {
        throw new BadRequestException('Inclua ao menos um item antes de aprovar');
      }
      locked.status = StatusOrcamentoVersao.APROVADO;
      locked.atualizadoEm = new Date();
      await manager.save(locked);
      await this.supersedearVersoesAprovadasMesmoPeriodo(manager, locked);
      return locked;
    });
  }

  async cancelarVersao(versaoId: string, empresaId: string) {
    const v = await this.versoes.findOne({ where: { id: versaoId, empresaId } });
    if (!v) throw new NotFoundException('Versão de orçamento não encontrada');
    if (v.status !== StatusOrcamentoVersao.RASCUNHO && v.status !== StatusOrcamentoVersao.APROVADO) {
      throw new ConflictException('Somente rascunho ou aprovado podem ser cancelados');
    }
    v.status = StatusOrcamentoVersao.CANCELADO;
    v.atualizadoEm = new Date();
    return this.versoes.save(v);
  }

  async fecharVersao(versaoId: string, empresaId: string) {
    const v = await this.versoes.findOne({ where: { id: versaoId, empresaId } });
    if (!v) throw new NotFoundException('Versão de orçamento não encontrada');
    if (v.status !== StatusOrcamentoVersao.APROVADO) {
      throw new ConflictException('Somente versões aprovadas podem ser fechadas');
    }
    v.status = StatusOrcamentoVersao.FECHADO;
    v.atualizadoEm = new Date();
    return this.versoes.save(v);
  }

  async realizadoVsPrevisto(versaoId: string, empresaId: string) {
    const { versao, itens } = await this.obterVersao(versaoId, empresaId);
    const de = `${versao.ano}-${String(versao.mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(versao.ano, versao.mes, 0).getDate();
    const ate = `${versao.ano}-${String(versao.mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    const dreLinhas = await this.dre.linhasCompetencia(empresaId, { de, ate });
    const idxRealizado = new Map<string, number>();
    for (const l of dreLinhas) {
      const key = `${l.categoria_id}|${l.centro_custo_id ?? ''}|${l.departamento_id ?? ''}`;
      idxRealizado.set(key, roundMoney((idxRealizado.get(key) ?? 0) + l.valor));
    }

    const comparativo = itens.map((i) => {
      const key = `${i.categoriaId}|${i.centroCustoId ?? ''}|${i.departamentoId ?? ''}`;
      const previsto = fromMoney(i.valorPrevisto);
      const realizado = idxRealizado.get(key) ?? 0;
      return {
        categoria_id: i.categoriaId,
        centro_custo_id: i.centroCustoId,
        departamento_id: i.departamentoId,
        valor_previsto: previsto,
        valor_realizado: realizado,
        variacao: roundMoney(realizado - previsto),
      };
    });

    const totalPrevisto = roundMoney(comparativo.reduce((s, r) => s + r.valor_previsto, 0));
    const totalRealizado = roundMoney(comparativo.reduce((s, r) => s + r.valor_realizado, 0));

    return {
      versao,
      periodo: { de, ate },
      totais: {
        previsto: totalPrevisto,
        realizado: totalRealizado,
        variacao: roundMoney(totalRealizado - totalPrevisto),
      },
      linhas: comparativo,
    };
  }

  private async supersedearVersoesAprovadasMesmoPeriodo(
    manager: EntityManager,
    atual: OrcamentoVersao,
  ) {
    const anteriores = await manager.find(OrcamentoVersao, {
      where: {
        empresaId: atual.empresaId,
        ano: atual.ano,
        mes: atual.mes,
        status: StatusOrcamentoVersao.APROVADO,
      },
    });
    for (const ant of anteriores) {
      if (ant.id === atual.id) continue;
      ant.status = StatusOrcamentoVersao.SUPERSEDED;
      ant.atualizadoEm = new Date();
      await manager.save(ant);
    }
  }

  private async assertCategoriaFolha(empresaId: string, categoriaId: string) {
    const cat = await this.categorias.findOne({ where: { id: categoriaId } });
    if (!cat) throw new NotFoundException('Categoria não encontrada');
    if (cat.empresaId && cat.empresaId !== empresaId) {
      throw new BadRequestException('Categoria não pertence à empresa');
    }
    const filhos = await this.categorias.count({ where: { paiId: categoriaId } });
    if (filhos > 0) {
      throw new BadRequestException('Itens de orçamento devem usar categorias folha (sem filhos)');
    }
  }
}