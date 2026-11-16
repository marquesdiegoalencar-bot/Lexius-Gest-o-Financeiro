import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CentroCusto } from '../../database/entities/centro-custo.entity';
import { CreateCentroCustoDto } from './dto/create-centro-custo.dto';

@Injectable()
export class CentrosCustoService {
  constructor(@InjectRepository(CentroCusto) private repo: Repository<CentroCusto>) {}

  list(empresaId: string) {
    return this.repo.find({ where: { empresaId }, order: { nome: 'ASC' } });
  }

  async findOne(id: string, empresaId: string) {
    const c = await this.repo.findOne({ where: { id, empresaId } });
    if (!c) throw new NotFoundException('Centro de custo não encontrado');
    return c;
  }

  create(empresaId: string, dto: CreateCentroCustoDto) {
    return this.repo.save(this.repo.create({ empresaId, nome: dto.nome }));
  }
}