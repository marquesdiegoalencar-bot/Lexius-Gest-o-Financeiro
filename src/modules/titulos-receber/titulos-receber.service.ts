import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { toMoneyString } from '../../common/utils/money';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { OrigemTitulo, StatusTitulo } from '../../database/enums';
import { CreateTituloReceberDto } from './dto/create-titulo-receber.dto';
import { FiltroTituloReceberDto } from './dto/filtro-titulo-receber.dto';
import { ParcelarTituloReceberDto } from './dto/parcelar-titulo-receber.dto';
import { CentrosCustoService } from '../centros-custo/centros-custo.service';

@Injectable()
export class TitulosReceberService {
  constructor(
    private auditoria: AuditoriaService,
    private centrosCusto: CentrosCustoService,
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
    return qb.getMany();
  }

  async findOne(id: string, empresaId: string) {
    const t = await this.repo.findOne({ where: { id, empresaId } });
    if (!t) throw new NotFoundException('Título não encontrado');
    return t;
  }

  async createManual(empresaId: string, usuarioId: string, dto: CreateTituloReceberDto) {
    if (dto.centro_custo_id) {
      await this.centrosCusto.assertVinculoFinanceiro(empresaId, dto.centro_custo_id);
    }
    const titulo = await this.repo.save(
      this.repo.create({
        empresaId,
        descricao: dto.descricao,
        pessoaId: dto.pessoa_id ?? null,
        credorId: dto.credor_id ?? null,
        categoriaId: dto.categoria_id,
        centroCustoId: dto.centro_custo_id ?? null,
        contaBancariaId: dto.conta_bancaria_id ?? null,
        origem: OrigemTitulo.MANUAL,
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
      entidade: 'titulo_receber',
      entidadeId: titulo.id,
      acao: 'CRIAR',
      depois: { id: titulo.id, valor: titulo.valorOriginal },
    });
    return titulo;
  }

  async parcelar(empresaId: string, usuarioId: string, dto: ParcelarTituloReceberDto) {
    if (dto.centro_custo_id) {
      await this.centrosCusto.assertVinculoFinanceiro(empresaId, dto.centro_custo_id);
    }
    const grupoId = randomUUID();
    const total = dto.parcelas.length;
    const titulos: TituloReceber[] = [];
    for (let i = 0; i < dto.parcelas.length; i++) {
      const p = dto.parcelas[i];
      const titulo = await this.repo.save(
        this.repo.create({
          empresaId,
          descricao: p.descricao,
          pessoaId: dto.pessoa_id ?? null,
          credorId: dto.credor_id ?? null,
          categoriaId: dto.categoria_id,
          centroCustoId: dto.centro_custo_id ?? null,
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