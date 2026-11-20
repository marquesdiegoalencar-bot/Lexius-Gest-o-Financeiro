import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { toMoneyString } from '../../common/utils/money';
import { TituloPagar } from '../../database/entities/titulo-pagar.entity';
import { OrigemTitulo, StatusAprovacaoTituloPagar, StatusTitulo } from '../../database/enums';
import { CreateTituloPagarDto } from './dto/create-titulo-pagar.dto';
import { FiltroTituloPagarDto } from './dto/filtro-titulo-pagar.dto';
import { RejeitarTituloPagarDto } from './dto/rejeitar-titulo-pagar.dto';
import { FinanceiroDimensoesService } from '../../common/financeiro/financeiro-dimensoes.service';
import { RateioService } from '../rateio/rateio.service';

@Injectable()
export class TitulosPagarService {
  constructor(
    private auditoria: AuditoriaService,
    private financeiroDimensoes: FinanceiroDimensoesService,
    private rateio: RateioService,
    private dataSource: DataSource,
    @InjectRepository(TituloPagar) private repo: Repository<TituloPagar>,
  ) {}

  async list(empresaId: string, filtros: FiltroTituloPagarDto) {
    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.empresa_id = :empresaId', { empresaId })
      .orderBy('t.data_vencimento', 'ASC');

    if (filtros.de) qb.andWhere('t.data_vencimento >= :de', { de: filtros.de });
    if (filtros.ate) qb.andWhere('t.data_vencimento <= :ate', { ate: filtros.ate });
    if (filtros.status) qb.andWhere('t.status = :status', { status: filtros.status });
    if (filtros.pessoa_id) qb.andWhere('t.fornecedor_id = :fornecedorId', { fornecedorId: filtros.pessoa_id });
    if (filtros.categoria_id) qb.andWhere('t.categoria_id = :categoriaId', { categoriaId: filtros.categoria_id });
    if (filtros.origem) qb.andWhere('t.origem = :origem', { origem: filtros.origem });
    if (filtros.departamento_id) {
      qb.andWhere('t.departamento_id = :departamentoId', { departamentoId: filtros.departamento_id });
    }
    if (filtros.centro_custo_id) {
      qb.andWhere('t.centro_custo_id = :centroCustoId', { centroCustoId: filtros.centro_custo_id });
    }
    return qb.getMany();
  }

  async findOne(id: string, empresaId: string) {
    const t = await this.repo.findOne({ where: { id, empresaId } });
    if (!t) throw new NotFoundException('Título não encontrado');
    return t;
  }

  async create(empresaId: string, usuarioId: string, dto: CreateTituloPagarDto) {
    if (dto.parcelas?.length) {
      const resultado = this.financeiroDimensoes.precisaTransacao(dto)
        ? await this.dataSource.transaction((manager) =>
            this.criarParcelado(manager, empresaId, usuarioId, dto),
          )
        : await this.criarParcelado(this.repo.manager, empresaId, usuarioId, dto);
      return resultado;
    }

    if (!dto.descricao || dto.valor_original == null || !dto.data_vencimento) {
      throw new BadRequestException('descricao, valor_original e data_vencimento são obrigatórios');
    }

    const titulo = this.financeiroDimensoes.precisaTransacao(dto)
      ? await this.dataSource.transaction((manager) =>
          this.criarTituloPagarAvulso(manager, empresaId, usuarioId, dto),
        )
      : await this.criarTituloPagarAvulso(this.repo.manager, empresaId, usuarioId, dto);

    await this.auditoria.registrar({
      empresaId,
      usuarioId,
      entidade: 'titulo_pagar',
      entidadeId: titulo.id,
      acao: 'CRIAR',
      depois: { id: titulo.id },
    });
    return titulo;
  }

  private async criarParcelado(
    manager: EntityManager,
    empresaId: string,
    usuarioId: string,
    dto: CreateTituloPagarDto,
  ) {
    await this.financeiroDimensoes.assertNovosVinculosTx(manager, empresaId, dto);
    const grupoId = randomUUID();
    const total = dto.parcelas!.length;
    const titulos: TituloPagar[] = [];
    for (let i = 0; i < dto.parcelas!.length; i++) {
      const p = dto.parcelas![i];
      const titulo = await manager.save(
        TituloPagar,
        manager.create(TituloPagar, {
          empresaId,
          descricao: p.descricao,
          fornecedorId: dto.fornecedor_id ?? null,
          categoriaId: dto.categoria_id,
          centroCustoId: dto.centro_custo_id ?? null,
          departamentoId: dto.departamento_id ?? null,
          contaBancariaId: dto.conta_bancaria_id ?? null,
          recorrenciaId: dto.recorrencia_id ?? null,
          origem: dto.recorrencia_id ? OrigemTitulo.RECORRENCIA : OrigemTitulo.MANUAL,
          grupoParcelasId: grupoId,
          parcelaNumero: i + 1,
          parcelaTotal: total,
          valorOriginal: toMoneyString(p.valor_original),
          dataVencimento: p.data_vencimento,
          formaPrevista: dto.forma_prevista ?? null,
          observacao: dto.observacao ?? null,
          criadoPor: usuarioId,
        }),
      );
      await this.rateio.registrarVigenciaLegadoTx(manager, {
        empresaId,
        pagarId: titulo.id,
        centroCustoId: titulo.centroCustoId,
        departamentoId: titulo.departamentoId,
        dataReferencia: titulo.dataCompetencia ?? titulo.dataEmissao ?? titulo.dataVencimento,
      });
      titulos.push(titulo);
    }
    return { grupo_parcelas_id: grupoId, titulos };
  }

  private async criarTituloPagarAvulso(
    manager: EntityManager,
    empresaId: string,
    usuarioId: string,
    dto: CreateTituloPagarDto,
  ) {
    await this.financeiroDimensoes.assertNovosVinculosTx(manager, empresaId, dto);
    const titulo = await manager.save(
      TituloPagar,
      manager.create(TituloPagar, {
        empresaId,
        descricao: dto.descricao!,
        fornecedorId: dto.fornecedor_id ?? null,
        categoriaId: dto.categoria_id,
        centroCustoId: dto.centro_custo_id ?? null,
        departamentoId: dto.departamento_id ?? null,
        contaBancariaId: dto.conta_bancaria_id ?? null,
        recorrenciaId: dto.recorrencia_id ?? null,
        origem: dto.recorrencia_id ? OrigemTitulo.RECORRENCIA : OrigemTitulo.MANUAL,
        valorOriginal: toMoneyString(dto.valor_original!),
        dataVencimento: dto.data_vencimento!,
        dataCompetencia: dto.data_competencia ?? dto.data_vencimento ?? null,
        formaPrevista: dto.forma_prevista ?? null,
        observacao: dto.observacao ?? null,
        criadoPor: usuarioId,
      }),
    );
    await this.rateio.registrarVigenciaLegadoTx(manager, {
      empresaId,
      pagarId: titulo.id,
      centroCustoId: titulo.centroCustoId,
      departamentoId: titulo.departamentoId,
      dataReferencia: titulo.dataCompetencia ?? titulo.dataEmissao ?? titulo.dataVencimento,
    });
    return titulo;
  }

  async aprovar(id: string, empresaId: string, usuarioId: string) {
    const titulo = await this.findOne(id, empresaId);
    if (titulo.statusAprovacao === StatusAprovacaoTituloPagar.APROVADO) return titulo;
    if (titulo.statusAprovacao === StatusAprovacaoTituloPagar.REJEITADO) {
      throw new BadRequestException('Título rejeitado não pode ser aprovado sem novo lançamento');
    }
    const antes = { status_aprovacao: titulo.statusAprovacao };
    titulo.statusAprovacao = StatusAprovacaoTituloPagar.APROVADO;
    titulo.aprovadoPor = usuarioId;
    titulo.aprovadoEm = new Date();
    const saved = await this.repo.save(titulo);
    await this.auditoria.registrar({
      empresaId,
      usuarioId,
      entidade: 'titulo_pagar',
      entidadeId: titulo.id,
      acao: 'APROVAR',
      antes,
      depois: { status_aprovacao: saved.statusAprovacao },
    });
    return saved;
  }

  async rejeitar(id: string, empresaId: string, usuarioId: string, dto: RejeitarTituloPagarDto) {
    const titulo = await this.findOne(id, empresaId);
    if (titulo.status === StatusTitulo.PAGO) {
      throw new BadRequestException('Título pago não pode ser rejeitado');
    }
    const antes = { status_aprovacao: titulo.statusAprovacao };
    titulo.statusAprovacao = StatusAprovacaoTituloPagar.REJEITADO;
    titulo.rejeitadoMotivo = dto.motivo;
    titulo.aprovadoPor = null;
    titulo.aprovadoEm = null;
    const saved = await this.repo.save(titulo);
    await this.auditoria.registrar({
      empresaId,
      usuarioId,
      entidade: 'titulo_pagar',
      entidadeId: titulo.id,
      acao: 'REJEITAR',
      antes,
      depois: { status_aprovacao: saved.statusAprovacao, motivo: dto.motivo },
    });
    return saved;
  }
}