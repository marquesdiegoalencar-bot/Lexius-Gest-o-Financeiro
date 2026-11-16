import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { soDigitos } from '../../common/utils/documento';
import { Pessoa } from '../../database/entities/pessoa.entity';
import { CreatePessoaDto } from './dto/create-pessoa.dto';
import { UpdatePessoaDto } from './dto/update-pessoa.dto';

@Injectable()
export class PessoasService {
  constructor(@InjectRepository(Pessoa) private repo: Repository<Pessoa>) {}

  async findAll(q?: string, documento?: string) {
    if (documento) {
      const doc = soDigitos(documento);
      return this.repo.find({ where: { documento: doc ?? undefined }, take: 50 });
    }
    if (q) {
      return this.repo.find({ where: { nome: ILike(`%${q}%`) }, take: 50, order: { nome: 'ASC' } });
    }
    return this.repo.find({ take: 100, order: { nome: 'ASC' } });
  }

  async findOne(id: string) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Pessoa não encontrada');
    return p;
  }

  create(dto: CreatePessoaDto) {
    return this.repo.save(
      this.repo.create({
        tipoPessoa: dto.tipo_pessoa,
        nome: dto.nome,
        documento: soDigitos(dto.documento),
        email: dto.email ?? null,
        telefone: dto.telefone ?? null,
        ehCliente: dto.eh_cliente ?? false,
        ehFornecedor: dto.eh_fornecedor ?? false,
        ehCredor: dto.eh_credor ?? false,
        ehColaborador: dto.eh_colaborador ?? false,
        ehAdvogado: dto.eh_advogado ?? false,
        cobrancaRefId: dto.cobranca_ref_id ?? null,
      }),
    );
  }

  async update(id: string, dto: UpdatePessoaDto) {
    const p = await this.findOne(id);
    if (dto.nome !== undefined) p.nome = dto.nome;
    if (dto.documento !== undefined) p.documento = soDigitos(dto.documento);
    if (dto.email !== undefined) p.email = dto.email;
    if (dto.telefone !== undefined) p.telefone = dto.telefone;
    if (dto.eh_cliente !== undefined) p.ehCliente = dto.eh_cliente;
    if (dto.eh_fornecedor !== undefined) p.ehFornecedor = dto.eh_fornecedor;
    if (dto.eh_credor !== undefined) p.ehCredor = dto.eh_credor;
    if (dto.eh_colaborador !== undefined) p.ehColaborador = dto.eh_colaborador;
    if (dto.eh_advogado !== undefined) p.ehAdvogado = dto.eh_advogado;
    return this.repo.save(p);
  }
}