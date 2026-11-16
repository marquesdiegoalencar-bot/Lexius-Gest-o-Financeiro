import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Natureza } from '../../database/enums';
import { Categoria } from '../../database/entities/categoria.entity';
import { CreateCategoriaDto } from './dto/create-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(@InjectRepository(Categoria) private repo: Repository<Categoria>) {}

  async list(empresaId: string, natureza?: Natureza) {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.empresa_id IS NULL OR c.empresa_id = :empresaId', { empresaId })
      .orderBy('c.codigo', 'ASC', 'NULLS LAST');
    if (natureza) {
      qb.andWhere('c.natureza = :natureza', { natureza });
    }
    return qb.getMany();
  }

  async findOne(id: string) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Categoria não encontrada');
    return c;
  }

  create(dto: CreateCategoriaDto) {
    return this.repo.save(
      this.repo.create({
        empresaId: dto.empresa_id ?? null,
        paiId: dto.pai_id ?? null,
        codigo: dto.codigo ?? null,
        nome: dto.nome,
        natureza: dto.natureza,
      }),
    );
  }

  async findRecebimentoCobrancaGlobal() {
    const cat = await this.repo
      .createQueryBuilder('c')
      .where('c.empresa_id IS NULL')
      .andWhere('c.codigo = :codigo', { codigo: '1.01' })
      .getOne();
    if (!cat) {
      throw new NotFoundException('Categoria global 1.01 não encontrada (rode schema.sql)');
    }
    return cat;
  }
}