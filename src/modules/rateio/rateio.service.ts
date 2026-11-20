import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  LinhaRateioDistribuicao,
  validarTotaisRateio,
} from '../../common/financeiro/rateio-distribuicao';
import { FinanceiroDimensoesService } from '../../common/financeiro/financeiro-dimensoes.service';
import {
  FUSO_NEGOCIO_PADRAO,
  competenciaParaInstante,
  parseVigenciaInstante,
} from '../../common/financeiro/fuso-negocio';
import { Empresa } from '../../database/entities/empresa.entity';
import { fromMoney, roundMoney } from '../../common/utils/money';
import { TituloAlocacaoDefinicao } from '../../database/entities/titulo-alocacao-definicao.entity';
import { TituloAlocacaoItem } from '../../database/entities/titulo-alocacao-item.entity';
import { TituloRateioVigencia } from '../../database/entities/titulo-rateio-vigencia.entity';
import { TituloRateioVigenciaItem } from '../../database/entities/titulo-rateio-vigencia-item.entity';
import { TituloPagar } from '../../database/entities/titulo-pagar.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import {
  ModoRateio,
  OrigemTituloRateioVigencia,
  StatusTituloAlocacao,
} from '../../database/enums';
import { ConfirmarRateioDto } from './dto/confirmar-rateio.dto';
import { IniciarRateioDto } from './dto/iniciar-rateio.dto';
import { SalvarRateioItensDto } from './dto/salvar-rateio-itens.dto';

type TituloRef = { receberId?: string; pagarId?: string };

@Injectable()
export class RateioService {
  constructor(
    private dataSource: DataSource,
    private financeiroDimensoes: FinanceiroDimensoesService,
    @InjectRepository(TituloAlocacaoDefinicao)
    private definicoes: Repository<TituloAlocacaoDefinicao>,
    @InjectRepository(TituloAlocacaoItem) private itens: Repository<TituloAlocacaoItem>,
    @InjectRepository(TituloRateioVigencia) private vigencias: Repository<TituloRateioVigencia>,
    @InjectRepository(TituloReceber) private titulosReceber: Repository<TituloReceber>,
    @InjectRepository(TituloPagar) private titulosPagar: Repository<TituloPagar>,
    @InjectRepository(Empresa) private empresas: Repository<Empresa>,
  ) {}

  /** Cancelamento efetivo — somente rascunho sem alocação financeira gerada. */
  async cancelarRascunho(definicaoId: string, empresaId: string) {
    return this.dataSource.transaction(async (manager) => {
      const def = await manager.findOne(TituloAlocacaoDefinicao, {
        where: { id: definicaoId, empresaId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!def) throw new NotFoundException('Definição de rateio não encontrada');
      if (def.status !== StatusTituloAlocacao.RASCUNHO) {
        throw new ConflictException(
          'Somente rascunhos podem ser cancelados; definições confirmadas preservam histórico',
        );
      }
      def.status = StatusTituloAlocacao.CANCELADO;
      def.atualizadoEm = new Date();
      await manager.save(def);
      return def;
    });
  }

  async historicoDefinicoes(empresaId: string, ref: TituloRef) {
    const where = ref.receberId
      ? { empresaId, tituloReceberId: ref.receberId }
      : { empresaId, tituloPagarId: ref.pagarId! };
    const defs = await this.definicoes.find({
      where,
      order: { criadoEm: 'DESC' },
    });
    return defs;
  }

  async fusoEmpresaTx(manager: EntityManager, empresaId: string): Promise<string> {
    const e = await manager.findOne(Empresa, { where: { id: empresaId } });
    return e?.fusoNegocio ?? FUSO_NEGOCIO_PADRAO;
  }

  async rascunhoReceber(empresaId: string, tituloId: string, dto: IniciarRateioDto) {
    await this.assertTituloReceber(empresaId, tituloId);
    return this.criarRascunho(empresaId, { receberId: tituloId }, dto.modo ?? ModoRateio.PERCENTUAL);
  }

  async rascunhoPagar(empresaId: string, tituloId: string, dto: IniciarRateioDto) {
    await this.assertTituloPagar(empresaId, tituloId);
    return this.criarRascunho(empresaId, { pagarId: tituloId }, dto.modo ?? ModoRateio.PERCENTUAL);
  }

  async obterDefinicao(definicaoId: string, empresaId: string) {
    const def = await this.definicoes.findOne({ where: { id: definicaoId, empresaId } });
    if (!def) throw new NotFoundException('Definição de rateio não encontrada');
    const linhas = await this.itens.find({
      where: { definicaoId },
      order: { linha: 'ASC' },
    });
    return { definicao: def, itens: linhas };
  }

  async salvarItens(definicaoId: string, empresaId: string, dto: SalvarRateioItensDto) {
    return this.dataSource.transaction(async (manager) => {
      const def = await manager.findOne(TituloAlocacaoDefinicao, {
        where: { id: definicaoId, empresaId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!def) throw new NotFoundException('Definição de rateio não encontrada');
      if (def.status !== StatusTituloAlocacao.RASCUNHO) {
        throw new ConflictException('Somente rascunhos podem ser editados');
      }

      const valorTitulo = await this.valorTitulo(manager, empresaId, def);
      const linhas: LinhaRateioDistribuicao[] = dto.itens.map((i) => ({
        linha: i.linha,
        centro_custo_id: i.centro_custo_id ?? null,
        departamento_id: i.departamento_id ?? null,
        percentual: i.percentual ?? null,
        valor: i.valor ?? null,
      }));

      for (const linha of linhas) {
        if (!linha.centro_custo_id && !linha.departamento_id) {
          throw new BadRequestException('Cada linha precisa de centro de custo ou departamento');
        }
        await this.financeiroDimensoes.assertNovosVinculosTx(manager, empresaId, {
          centro_custo_id: linha.centro_custo_id,
          departamento_id: linha.departamento_id,
        });
      }

      try {
        validarTotaisRateio(def.modo, linhas, valorTitulo);
      } catch (e) {
        const code = e instanceof Error ? e.message : 'RATEIO_INVALIDO';
        if (code === 'PERCENTUAL_INVALIDO') {
          throw new BadRequestException('Percentuais devem somar 100');
        }
        if (code === 'VALOR_FIXO_INVALIDO') {
          throw new BadRequestException('Valores fixos devem somar o valor do título');
        }
        throw new BadRequestException('Rateio inválido');
      }

      await manager.delete(TituloAlocacaoItem, { definicaoId });
      const persistidos = dto.itens.map((i) =>
        manager.create(TituloAlocacaoItem, {
          definicaoId,
          empresaId,
          linha: i.linha,
          centroCustoId: i.centro_custo_id ?? null,
          departamentoId: i.departamento_id ?? null,
          percentual: i.percentual != null ? i.percentual.toFixed(4) : null,
          valor: i.valor != null ? i.valor.toFixed(2) : null,
        }),
      );
      await manager.save(persistidos);
      def.atualizadoEm = new Date();
      await manager.save(def);
      return { definicao: def, itens: persistidos };
    });
  }

  async confirmar(definicaoId: string, empresaId: string, dto: ConfirmarRateioDto) {
    return this.dataSource.transaction(async (manager) => {
      const def = await manager.findOne(TituloAlocacaoDefinicao, {
        where: { id: definicaoId, empresaId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!def) throw new NotFoundException('Definição de rateio não encontrada');
      if (def.status !== StatusTituloAlocacao.RASCUNHO) {
        throw new ConflictException('Rateio já confirmado ou cancelado');
      }
      if (dto.modo) def.modo = dto.modo;

      const itensDraft = await manager.find(TituloAlocacaoItem, {
        where: { definicaoId },
        order: { linha: 'ASC' },
      });
      if (!itensDraft.length) {
        throw new BadRequestException('Salve itens antes de confirmar');
      }

      const valorTitulo = await this.valorTitulo(manager, empresaId, def);
      const linhas: LinhaRateioDistribuicao[] = itensDraft.map((i) => ({
        linha: i.linha,
        centro_custo_id: i.centroCustoId,
        departamento_id: i.departamentoId,
        percentual: i.percentual != null ? Number(i.percentual) : null,
        valor: i.valor != null ? fromMoney(i.valor) : null,
      }));
      try {
        validarTotaisRateio(def.modo, linhas, valorTitulo);
      } catch (e) {
        const code = e instanceof Error ? e.message : 'RATEIO_INVALIDO';
        if (code === 'PERCENTUAL_INVALIDO') {
          throw new BadRequestException('Percentuais devem somar 100');
        }
        if (code === 'VALOR_FIXO_INVALIDO') {
          throw new BadRequestException('Valores fixos devem somar o valor do título');
        }
        throw new BadRequestException('Rateio inválido');
      }

      const fuso = await this.fusoEmpresaTx(manager, empresaId);
      const vigenteDesdeIso = parseVigenciaInstante(dto.vigente_desde, fuso);
      const vigenteDesde = new Date(vigenteDesdeIso);

      await this.supersedearDefinicoesConfirmadas(manager, empresaId, def);
      await this.fecharVigenciasAbertas(manager, empresaId, def, vigenteDesde);

      const vigencia = await manager.save(
        manager.create(TituloRateioVigencia, {
          empresaId,
          tituloReceberId: def.tituloReceberId,
          tituloPagarId: def.tituloPagarId,
          definicaoId: def.id,
          origem: OrigemTituloRateioVigencia.CONFIRMACAO,
          modo: def.modo,
          validoDe: vigenteDesde,
          validoAte: null,
        }),
      );

      const vigItens = itensDraft.map((i) =>
        manager.create(TituloRateioVigenciaItem, {
          vigenciaId: vigencia.id,
          empresaId,
          linha: i.linha,
          centroCustoId: i.centroCustoId,
          departamentoId: i.departamentoId,
          percentual: i.percentual,
          valor: i.valor,
        }),
      );
      await manager.save(vigItens);

      def.status = StatusTituloAlocacao.CONFIRMADO;
      await manager.save(def);

      return { definicao: def, vigencia, itens: vigItens };
    });
  }

  async vigenciaVigenteNaData(
    manager: EntityManager,
    empresaId: string,
    ref: TituloRef,
    data: string,
  ): Promise<TituloRateioVigencia | null> {
    const fuso = await this.fusoEmpresaTx(manager, empresaId);
    const instante =
      data.length > 10 ? new Date(data) : new Date(competenciaParaInstante(data.slice(0, 10), fuso));

    const qb = manager
      .createQueryBuilder(TituloRateioVigencia, 'v')
      .where('v.empresa_id = :empresaId', { empresaId })
      .andWhere('v.valido_de <= :inst', { inst: instante })
      .andWhere('(v.valido_ate IS NULL OR v.valido_ate > :inst)', { inst: instante })
      .orderBy('v.valido_de', 'DESC')
      .addOrderBy('v.criado_em', 'DESC')
      .limit(1);

    if (ref.receberId) {
      qb.andWhere('v.titulo_receber_id = :id', { id: ref.receberId });
    } else if (ref.pagarId) {
      qb.andWhere('v.titulo_pagar_id = :id', { id: ref.pagarId });
    } else {
      return null;
    }

    return qb.getOne();
  }

  private async criarRascunho(empresaId: string, ref: TituloRef, modo: ModoRateio) {
    const where =
      ref.receberId != null
        ? { empresaId, tituloReceberId: ref.receberId, status: StatusTituloAlocacao.RASCUNHO }
        : { empresaId, tituloPagarId: ref.pagarId!, status: StatusTituloAlocacao.RASCUNHO };

    const existente = await this.definicoes.findOne({ where });
    if (existente) return this.obterDefinicao(existente.id, empresaId);

    const def = this.definicoes.create({
      empresaId,
      tituloReceberId: ref.receberId ?? null,
      tituloPagarId: ref.pagarId ?? null,
      modo,
      status: StatusTituloAlocacao.RASCUNHO,
    });
    const salvo = await this.definicoes.save(def);
    return { definicao: salvo, itens: [] };
  }

  private async supersedearDefinicoesConfirmadas(
    manager: EntityManager,
    empresaId: string,
    def: TituloAlocacaoDefinicao,
  ) {
    const qb = manager
      .createQueryBuilder(TituloAlocacaoDefinicao, 'd')
      .where('d.empresa_id = :empresaId', { empresaId })
      .andWhere('d.status = :st', { st: StatusTituloAlocacao.CONFIRMADO });
    if (def.tituloReceberId) {
      qb.andWhere('d.titulo_receber_id = :id', { id: def.tituloReceberId });
    } else {
      qb.andWhere('d.titulo_pagar_id = :id', { id: def.tituloPagarId });
    }
    const anteriores = await qb.getMany();
    for (const ant of anteriores) {
      ant.status = StatusTituloAlocacao.SUPERSEDED;
      ant.atualizadoEm = new Date();
      await manager.save(ant);
    }
  }

  private async fecharVigenciasAbertas(
    manager: EntityManager,
    empresaId: string,
    def: TituloAlocacaoDefinicao,
    vigenteDesdeNovo: Date,
  ) {
    const qb = manager
      .createQueryBuilder(TituloRateioVigencia, 'v')
      .where('v.empresa_id = :empresaId', { empresaId })
      .andWhere('(v.valido_ate IS NULL OR v.valido_ate > :desde)', { desde: vigenteDesdeNovo });

    if (def.tituloReceberId) {
      qb.andWhere('v.titulo_receber_id = :id', { id: def.tituloReceberId });
    } else {
      qb.andWhere('v.titulo_pagar_id = :id', { id: def.tituloPagarId });
    }

    const abertas = await qb.getMany();
    for (const v of abertas) {
      if (v.validoDe >= vigenteDesdeNovo) continue;
      v.validoAte = vigenteDesdeNovo;
      await manager.save(v);
    }
  }

  private async valorTitulo(
    manager: EntityManager,
    empresaId: string,
    def: TituloAlocacaoDefinicao,
  ): Promise<number> {
    if (def.tituloReceberId) {
      const t = await manager.findOne(TituloReceber, {
        where: { id: def.tituloReceberId, empresaId },
      });
      if (!t) throw new NotFoundException('Título a receber não encontrado');
      return roundMoney(
        fromMoney(t.valorOriginal) - fromMoney(t.desconto) + fromMoney(t.juros) + fromMoney(t.multa),
      );
    }
    const t = await manager.findOne(TituloPagar, {
      where: { id: def.tituloPagarId!, empresaId },
    });
    if (!t) throw new NotFoundException('Título a pagar não encontrado');
    return roundMoney(
      fromMoney(t.valorOriginal) - fromMoney(t.desconto) + fromMoney(t.juros) + fromMoney(t.multa),
    );
  }

  private async assertTituloReceber(empresaId: string, tituloId: string) {
    const t = await this.titulosReceber.findOne({ where: { id: tituloId, empresaId } });
    if (!t) throw new NotFoundException('Título a receber não encontrado');
    return t;
  }

  private async assertTituloPagar(empresaId: string, tituloId: string) {
    const t = await this.titulosPagar.findOne({ where: { id: tituloId, empresaId } });
    if (!t) throw new NotFoundException('Título a pagar não encontrado');
    return t;
  }

  /** Vigência LEGADO 100% nas dimensões do título (Bloco D + E). */
  async registrarVigenciaLegadoTx(
    manager: EntityManager,
    params: {
      empresaId: string;
      receberId?: string;
      pagarId?: string;
      centroCustoId: string | null;
      departamentoId: string | null;
      dataReferencia: string;
    },
  ): Promise<void> {
    if (!params.centroCustoId && !params.departamentoId) return;

    const fuso = await this.fusoEmpresaTx(manager, params.empresaId);
    const vigenteDesde = new Date(competenciaParaInstante(params.dataReferencia.slice(0, 10), fuso));

    const vigencia = await manager.save(
      TituloRateioVigencia,
      manager.create(TituloRateioVigencia, {
        empresaId: params.empresaId,
        tituloReceberId: params.receberId ?? null,
        tituloPagarId: params.pagarId ?? null,
        definicaoId: null,
        origem: OrigemTituloRateioVigencia.LEGADO,
        modo: ModoRateio.PERCENTUAL,
        validoDe: vigenteDesde,
        validoAte: null,
      }),
    );

    await manager.save(
      TituloRateioVigenciaItem,
      manager.create(TituloRateioVigenciaItem, {
        vigenciaId: vigencia.id,
        empresaId: params.empresaId,
        linha: 1,
        centroCustoId: params.centroCustoId,
        departamentoId: params.departamentoId,
        percentual: '100',
        valor: null,
      }),
    );
  }
}