import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CentroCusto } from '../../database/entities/centro-custo.entity';
import { TipoCentroCusto } from '../../database/enums';
import { CreateCentroCustoDto } from './dto/create-centro-custo.dto';
import { UpdateCentroCustoDto } from './dto/update-centro-custo.dto';

@Injectable()
export class CentrosCustoService {
  constructor(@InjectRepository(CentroCusto) private repo: Repository<CentroCusto>) {}

  list(empresaId: string, tipo?: TipoCentroCusto) {
    const where: { empresaId: string; tipo?: TipoCentroCusto } = { empresaId };
    if (tipo) where.tipo = tipo;
    return this.repo.find({
      where,
      order: { codigo: 'ASC', nome: 'ASC' },
    });
  }

  async findOne(id: string, empresaId: string) {
    const c = await this.repo.findOne({ where: { id, empresaId } });
    if (!c) throw new NotFoundException('Centro de custo não encontrado');
    return c;
  }

  async create(empresaId: string, dto: CreateCentroCustoDto) {
    await this.assertCodigoLivre(empresaId, dto.codigo, undefined);
    return this.repo.save(
      this.repo.create({
        empresaId,
        codigo: dto.codigo?.trim() || null,
        nome: dto.nome.trim(),
        descricao: dto.descricao?.trim() || null,
        tipo: dto.tipo ?? TipoCentroCusto.ENTRADA,
      }),
    );
  }

  async update(id: string, empresaId: string, dto: UpdateCentroCustoDto) {
    const c = await this.findOne(id, empresaId);
    if (dto.codigo !== undefined) {
      await this.assertCodigoLivre(empresaId, dto.codigo, id);
      c.codigo = dto.codigo?.trim() || null;
    }
    if (dto.nome !== undefined) c.nome = dto.nome.trim();
    if (dto.descricao !== undefined) c.descricao = dto.descricao?.trim() || null;
    if (dto.tipo !== undefined) c.tipo = dto.tipo;
    if (dto.ativo !== undefined) c.ativo = dto.ativo;
    return this.repo.save(c);
  }

  private async assertCodigoLivre(empresaId: string, codigo: string | undefined, ignoreId?: string) {
    const code = codigo?.trim();
    if (!code) return;
    const dup = await this.repo.findOne({ where: { empresaId, codigo: code } });
    if (dup && dup.id !== ignoreId) {
      throw new ConflictException(`Código de centro de custo já em uso: ${code}`);
    }
  }
}