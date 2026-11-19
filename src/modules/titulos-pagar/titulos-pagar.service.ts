import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { toMoneyString } from '../../common/utils/money';
import { TituloPagar } from '../../database/entities/titulo-pagar.entity';
import { OrigemTitulo, StatusAprovacaoTituloPagar, StatusTitulo } from '../../database/enums';
import { CreateTituloPagarDto } from './dto/create-titulo-pagar.dto';
import { FiltroTituloPagarDto } from './dto/filtro-titulo-pagar.dto';
import { RejeitarTituloPagarDto } from './dto/rejeitar-titulo-pagar.dto';
import { CentrosCustoService } from '../centros-custo/centros-custo.service';

@Injectable()
export class TitulosPagarService {
  constructor(
    private auditoria: AuditoriaService,
    private centrosCusto: CentrosCustoService,
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
    return qb.getMany();
  }

  async findOne(id: string, empresaId: string) {
    const t = await this.repo.findOne({ where: { id, empresaId } });
    if (!t) throw new NotFoundException('Título não encontrado');
    return t;
  }

  async create(empresaId: string, usuarioId: string, dto: CreateTituloPagarDto) {
    if (dto.centro_custo_id) {
      await this.centrosCusto.assertVinculoFinanceiro(empresaId, dto.centro_custo_id);
    }
    if (dto.parcelas?.length) {
      const grupoId = randomUUID();
      const total = dto.parcelas.length;
      const titulos: TituloPagar[] = [];
      for (let i = 0; i < dto.parcelas.length; i++) {
        const p = dto.parcelas[i];
        const titulo = await this.repo.save(
          this.repo.create({
            empresaId,
            descricao: p.descricao,
            fornecedorId: dto.fornecedor_id ?? null,
            categoriaId: dto.categoria_id,
            centroCustoId: dto.centro_custo_id ?? null,
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
        titulos.push(titulo);
      }
      return { grupo_parcelas_id: grupoId, titulos };
    }

    if (!dto.descricao || dto.valor_original == null || !dto.data_vencimento) {
      throw new BadRequestException('descricao, valor_original e data_vencimento são obrigatórios');
    }

    const titulo = await this.repo.save(
      this.repo.create({
        empresaId,
        descricao: dto.descricao,
        fornecedorId: dto.fornecedor_id ?? null,
        categoriaId: dto.categoria_id,
        centroCustoId: dto.centro_custo_id ?? null,
        contaBancariaId: dto.conta_bancaria_id ?? null,
        recorrenciaId: dto.recorrencia_id ?? null,
        origem: dto.recorrencia_id ? OrigemTitulo.RECORRENCIA : OrigemTitulo.MANUAL,
        valorOriginal: toMoneyString(dto.valor_original),
        dataVencimento: dto.data_vencimento,
        dataCompetencia: dto.data_competencia ?? null,
        formaPrevista: dto.forma_prevista ?? null,
        observacao: dto.observacao ?? null,
        criadoPor: usuarioId,
      }),
    );
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