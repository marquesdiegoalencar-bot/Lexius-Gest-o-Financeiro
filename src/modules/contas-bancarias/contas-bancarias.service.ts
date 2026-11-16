import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProvedorBancario, TipoContaBancaria } from '../../database/enums';
import { ContaBancaria } from '../../database/entities/conta-bancaria.entity';
import { CreateContaBancariaDto } from './dto/create-conta-bancaria.dto';
import { UpdateContaBancariaDto } from './dto/update-conta-bancaria.dto';

@Injectable()
export class ContasBancariasService {
  constructor(@InjectRepository(ContaBancaria) private repo: Repository<ContaBancaria>) {}

  list(empresaId: string) {
    return this.repo.find({ where: { empresaId }, order: { apelido: 'ASC' } });
  }

  async findOne(id: string, empresaId: string) {
    const conta = await this.repo.findOne({ where: { id, empresaId } });
    if (!conta) throw new NotFoundException('Conta bancária não encontrada');
    return conta;
  }

  async create(empresaId: string, dto: CreateContaBancariaDto) {
    if (dto.banco_codigo === '077') {
      throw new BadRequestException(
        'Integração Inter não disponível na Fase 1; use contas manuais ou caixa',
      );
    }
    return this.repo.save(
      this.repo.create({
        empresaId,
        apelido: dto.apelido,
        bancoCodigo: dto.banco_codigo,
        agencia: dto.agencia ?? null,
        conta: dto.conta ?? null,
        tipo: dto.tipo ?? TipoContaBancaria.CORRENTE,
        provedor: ProvedorBancario.MANUAL,
        saldoInicial: String(dto.saldo_inicial ?? 0),
        dataSaldoInicial: dto.data_saldo_inicial ?? new Date().toISOString().slice(0, 10),
        sincronizaExtrato: false,
        credencialRef: null,
      }),
    );
  }

  async update(id: string, empresaId: string, dto: UpdateContaBancariaDto) {
    const conta = await this.findOne(id, empresaId);
    if (dto.apelido !== undefined) conta.apelido = dto.apelido;
    if (dto.ativa !== undefined) conta.ativa = dto.ativa;
    return this.repo.save(conta);
  }
}