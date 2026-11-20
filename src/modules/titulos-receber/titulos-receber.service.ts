import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { FinanceiroDimensoesService } from '../../common/financeiro/financeiro-dimensoes.service';
import { toMoneyString } from '../../common/utils/money';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { OrigemTitulo, StatusTitulo } from '../../database/enums';
import { RateioService } from '../rateio/rateio.service';
import { CreateTituloReceberDto } from './dto/create-titulo-receber.dto';
import { FiltroTituloReceberDto } from './dto/filtro-titulo-receber.dto';
import { ParcelarTituloReceberDto } from './dto/parcelar-titulo-receber.dto';

@Injectable()
export class TitulosReceberService {
  constructor(
    private auditoria: AuditoriaService,
    private financeiroDimensoes: FinanceiroDimensoesService,
    private rateio: RateioService,
    private dataSource: DataSource,
    @InjectRepository(TituloReceber) private repo: Repository<TituloReceber>,
  ) {}

  async list(empresaId: string, filtros: FiltroTituloReceberDto) {
    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.empresa_id = :empresaId', { empresaId })
      .orderBy('t.data_vencimento', 'ASC');

    if (filtros.de) qb.andWhere('t.data_vencimento >= :de', { de: filtros.de });
    if (filtros.ate) qb.andWhere('t.data_vencimento <= :ate', { ate: filtros.ate });
    if (filtros.status) qb.andWhere('t.status = :status', { status: filtros.status });
    if (filtros.pessoa_id) qb.andWhere('t.pessoa_id = :pessoaId', { pessoaId: filtros.pessoa_id });
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

  async createManual(empresaId: string, usuarioId: string, dto: CreateTituloReceberDto) {
    const titulo = this.financeiroDimensoes.precisaTransacao(dto)
      ? await this.dataSource.transaction((manager) =>
          this.criarTituloReceberManual(manager, empresaId, usuarioId, dto),
        )
      : await this.criarTituloReceberManual(this.repo.manager, empresaId, usuarioId, dto);

    await this.auditoria.registrar({
      empresaId,
      usuarioId,
      entidade: 'titulo_receber',
      entidadeId: titulo.id,
      acao: 'CRIAR',
      depois: { id: titulo.id, valor: titulo.valorOriginal },
    });
    return titulo;
  }

  private async criarTituloReceberManual(
    manager: EntityManager,
    empresaId: string,
    usuarioId: string,
    dto: CreateTituloReceberDto,
  ) {
    await this.financeiroDimensoes.assertNovosVinculosTx(manager, empresaId, dto);
    const titulo = await manager.save(
      TituloReceber,
      manager.create(TituloReceber, {
        empresaId,
        descricao: dto.descricao,
        pessoaId: dto.pessoa_id ?? null,
        credorId: dto.credor_id ?? null,
        categoriaId: dto.categoria_id,
        centroCustoId: dto.centro_custo_id ?? null,
        departamentoId: dto.departamento_id ?? null,
        contaBancariaId: dto.conta_bancaria_id ?? null,
        origem: OrigemTitulo.MANUAL,
        valorOriginal: toMoneyString(dto.valor_original),
        dataVencimento: dto.data_vencimento,
        dataCompetencia: dto.data_competencia ?? dto.data_vencimento,
        formaPrevista: dto.forma_prevista ?? null,
        observacao: dto.observacao ?? null,
        criadoPor: usuarioId,
      }),
    );
    await this.rateio.registrarVigenciaLegadoTx(manager, {
      empresaId,
      receberId: titulo.id,
      centroCustoId: titulo.centroCustoId,
      departamentoId: titulo.departamentoId,
      dataReferencia: titulo.dataCompetencia ?? titulo.dataEmissao ?? titulo.dataVencimento,
    });
    return titulo;
  }

  async parcelar(empresaId: string, usuarioId: string, dto: ParcelarTituloReceberDto) {
    const resultado = this.financeiroDimensoes.precisaTransacao(dto)
      ? await this.dataSource.transaction((manager) =>
          this.parcelarEmTransacao(manager, empresaId, usuarioId, dto),
        )
      : await this.parcelarEmTransacao(this.repo.manager, empresaId, usuarioId, dto);
    return resultado;
  }

  private async parcelarEmTransacao(
    manager: EntityManager,
    empresaId: string,
    usuarioId: string,
    dto: ParcelarTituloReceberDto,
  ) {
    await this.financeiroDimensoes.assertNovosVinculosTx(manager, empresaId, dto);
    const grupoId = randomUUID();
    const total = dto.parcelas.length;
    const titulos: TituloReceber[] = [];
    for (let i = 0; i < dto.parcelas.length; i++) {
      const p = dto.parcelas[i];
      const titulo = await manager.save(
        TituloReceber,
        manager.create(TituloReceber, {
          empresaId,
          descricao: p.descricao,
          pessoaId: dto.pessoa_id ?? null,
          credorId: dto.credor_id ?? null,
          categoriaId: dto.categoria_id,
          centroCustoId: dto.centro_custo_id ?? null,
          departamentoId: dto.departamento_id ?? null,
          contaBancariaId: dto.conta_bancaria_id ?? null,
          origem: OrigemTitulo.MANUAL,
          grupoParcelasId: grupoId,
          parcelaNumero: i + 1,
          parcelaTotal: total,
          valorOriginal: toMoneyString(p.valor_original),
          dataVencimento: p.data_vencimento,
          formaPrevista: p.forma_prevista ?? null,
          observacao: dto.observacao ?? null,
          criadoPor: usuarioId,
        }),
      );
      await this.rateio.registrarVigenciaLegadoTx(manager, {
        empresaId,
        receberId: titulo.id,
        centroCustoId: titulo.centroCustoId,
        departamentoId: titulo.departamentoId,
        dataReferencia: titulo.dataCompetencia ?? titulo.dataEmissao ?? titulo.dataVencimento,
      });
      titulos.push(titulo);
    }
    return { grupo_parcelas_id: grupoId, titulos };
  }

  async cancelar(id: string, empresaId: string, usuarioId: string) {
    const titulo = await this.findOne(id, empresaId);
    if (titulo.status === StatusTitulo.PAGO) {
      throw new BadRequestException('Título pago não pode ser cancelado');
    }
    if (titulo.status === StatusTitulo.CANCELADO) {
      return titulo;
    }
    const antes = { status: titulo.status };
    titulo.status = StatusTitulo.CANCELADO;
    const saved = await this.repo.save(titulo);
    await this.auditoria.registrar({
      empresaId,
      usuarioId,
      entidade: 'titulo_receber',
      entidadeId: titulo.id,
      acao: 'EDITAR',
      antes,
      depois: { status: saved.status },
    });
    return saved;
  }
}