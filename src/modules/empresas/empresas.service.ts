import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Empresa } from '../../database/entities/empresa.entity';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

@Injectable()
export class EmpresasService {
  constructor(@InjectRepository(Empresa) private repo: Repository<Empresa>) {}

  findAll() {
    return this.repo.find({ order: { razaoSocial: 'ASC' } });
  }

  async findOne(id: string) {
    const empresa = await this.repo.findOne({ where: { id } });
    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    return empresa;
  }

  create(dto: CreateEmpresaDto) {
    const empresa = this.repo.create({
      tipo: dto.tipo,
      razaoSocial: dto.razao_social,
      nomeFantasia: dto.nome_fantasia ?? null,
      cnpj: dto.cnpj,
    });
    return this.repo.save(empresa);
  }

  async update(id: string, dto: UpdateEmpresaDto) {
    const empresa = await this.findOne(id);
    if (dto.razao_social !== undefined) empresa.razaoSocial = dto.razao_social;
    if (dto.nome_fantasia !== undefined) empresa.nomeFantasia = dto.nome_fantasia;
    if (dto.ativa !== undefined) empresa.ativa = dto.ativa;
    return this.repo.save(empresa);
  }
}