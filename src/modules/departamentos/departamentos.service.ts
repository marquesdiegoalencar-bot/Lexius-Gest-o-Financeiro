import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { Departamento } from '../../database/entities/departamento.entity';
import { CreateDepartamentoDto } from './dto/create-departamento.dto';
import { FiltroDepartamentoDto } from './dto/filtro-departamento.dto';
import { UpdateDepartamentoDto } from './dto/update-departamento.dto';

@Injectable()
export class DepartamentosService {
  constructor(@InjectRepository(Departamento) private repo: Repository<Departamento>) {}

  async list(empresaId: string, filtros: FiltroDepartamentoDto) {
    const qb = this.repo
      .createQueryBuilder('d')
      .where('d.empresa_id = :empresaId', { empresaId })
      .orderBy('d.nome', 'ASC');

    if (filtros.ativo !== undefined) {
      qb.andWhere('d.ativo = :ativo', { ativo: filtros.ativo });
    }
    if (filtros.q?.trim()) {
      const term = `%${filtros.q.trim()}%`;
      qb.andWhere('(d.nome ILIKE :term OR d.codigo ILIKE :term)', { term });
    }
    return qb.getMany();
  }

  async findOne(id: string, empresaId: string) {
    const d = await this.repo.findOne({ where: { id, empresaId } });
    if (!d) throw new NotFoundException('Departamento não encontrado');
    return d;
  }

  async create(empresaId: string, dto: CreateDepartamentoDto) {
    const nome = this.requireNome(dto.nome);
    await this.assertCodigoLivre(empresaId, dto.codigo, undefined);
    const entity = this.repo.create({
      empresaId,
      codigo: dto.codigo?.trim() || null,
      nome,
      descricao: dto.descricao?.trim() || null,
      ativo: dto.ativo ?? true,
    });
    return this.saveDepartamento(entity);
  }

  async update(id: string, empresaId: string, dto: UpdateDepartamentoDto) {
    const d = await this.findOne(id, empresaId);
    if (dto.codigo !== undefined) {
      await this.assertCodigoLivre(empresaId, dto.codigo, id);
      d.codigo = dto.codigo?.trim() || null;
    }
    if (dto.nome !== undefined) d.nome = this.requireNome(dto.nome);
    if (dto.descricao !== undefined) d.descricao = dto.descricao?.trim() || null;
    if (dto.ativo !== undefined) d.ativo = dto.ativo;
    return this.saveDepartamento(d);
  }

  /** Reservado para Bloco D — novos vínculos financeiros exigirão departamento ativo. */
  async assertVinculoFinanceiroFuturo(
    empresaId: string,
    departamentoId: string,
  ): Promise<void> {
    const d = await this.findOne(departamentoId, empresaId);
    if (!d.ativo) {
      throw new ConflictException(
        'Departamento inativo não pode receber novos vínculos financeiros',
      );
    }
  }

  async assertVinculoFinanceiroTx(
    manager: EntityManager,
    empresaId: string,
    departamentoId: string,
  ): Promise<void> {
    const d = await manager.findOne(Departamento, {
      where: { id: departamentoId, empresaId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!d) throw new NotFoundException('Departamento não encontrado');
    if (!d.ativo) {
      throw new ConflictException(
        'Departamento inativo não pode receber novos vínculos financeiros',
      );
    }
  }

  /** Garante nome válido quando o service é usado fora do pipe HTTP (ex.: Bloco D). */
  requireNome(nome: string | undefined | null): string {
    if (nome === undefined || nome === null) {
      throw new BadRequestException('Nome do departamento é obrigatório');
    }
    const trimmed = nome.trim();
    if (!trimmed) {
      throw new BadRequestException('Nome do departamento é obrigatório');
    }
    return trimmed;
  }

  private async saveDepartamento(entity: Departamento) {
    try {
      return await this.repo.save(entity);
    } catch (err) {
      if (this.isCodigoUniqueViolation(err)) {
        throw new ConflictException('Código de departamento já em uso nesta empresa');
      }
      throw err;
    }
  }

  private isCodigoUniqueViolation(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) return false;
    const pg = err.driverError as { code?: string; constraint?: string; detail?: string };
    if (pg?.code !== '23505') return false;
    const c = (pg.constraint ?? '').toLowerCase();
    if (c.includes('departamentos') && c.includes('codigo')) return true;
    if (c === 'uq_departamentos_empresa_codigo') return true;
    const detail = pg.detail ?? '';
    return detail.includes('departamentos') && detail.includes('codigo');
  }

  private async assertCodigoLivre(empresaId: string, codigo: string | undefined, ignoreId?: string) {
    const code = codigo?.trim();
    if (!code) return;
    const dup = await this.repo.findOne({ where: { empresaId, codigo: code } });
    if (dup && dup.id !== ignoreId) {
      throw new ConflictException(`Código de departamento já em uso: ${code}`);
    }
  }
}