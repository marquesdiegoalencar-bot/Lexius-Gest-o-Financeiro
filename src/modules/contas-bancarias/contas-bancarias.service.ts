import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BancoProviderRegistry } from '../banco/banco-provider.registry';
import { ExtratoSincronizacaoService } from '../banco/extrato-sincronizacao.service';
import { ProvedorBancario, TipoContaBancaria } from '../../database/enums';
import { ContaBancaria } from '../../database/entities/conta-bancaria.entity';
import { CreateContaBancariaDto } from './dto/create-conta-bancaria.dto';
import { UpdateContaBancariaDto } from './dto/update-conta-bancaria.dto';

@Injectable()
export class ContasBancariasService {
  constructor(
    @InjectRepository(ContaBancaria) private repo: Repository<ContaBancaria>,
    private bancoRegistry: BancoProviderRegistry,
    private sincronizacao: ExtratoSincronizacaoService,
  ) {}

  list(empresaId: string) {
    return this.repo.find({ where: { empresaId }, order: { apelido: 'ASC' } });
  }

  async findOne(id: string, empresaId: string) {
    const conta = await this.repo.findOne({ where: { id, empresaId } });
    if (!conta) throw new NotFoundException('Conta bancária não encontrada');
    return conta;
  }

  async create(empresaId: string, dto: CreateContaBancariaDto) {
    const provedor = dto.provedor ?? ProvedorBancario.MANUAL;

    if (provedor === ProvedorBancario.INTER) {
      if (dto.banco_codigo !== '077') {
        throw new BadRequestException('Conta Inter deve usar banco_codigo 077');
      }
      if (!dto.credencial_ref?.trim()) {
        throw new BadRequestException('credencial_ref é obrigatório para conta Inter');
      }
    } else if (dto.banco_codigo === '077' && provedor === ProvedorBancario.MANUAL) {
      throw new BadRequestException('Banco 077 exige provedor INTER');
    }

    return this.repo.save(
      this.repo.create({
        empresaId,
        apelido: dto.apelido,
        bancoCodigo: dto.banco_codigo,
        agencia: dto.agencia ?? null,
        conta: dto.conta ?? null,
        tipo: dto.tipo ?? TipoContaBancaria.CORRENTE,
        provedor,
        saldoInicial: String(dto.saldo_inicial ?? 0),
        dataSaldoInicial: dto.data_saldo_inicial ?? new Date().toISOString().slice(0, 10),
        sincronizaExtrato: dto.sincroniza_extrato ?? provedor === ProvedorBancario.INTER,
        credencialRef: dto.credencial_ref?.trim() ?? null,
      }),
    );
  }

  async update(id: string, empresaId: string, dto: UpdateContaBancariaDto) {
    const conta = await this.findOne(id, empresaId);
    if (dto.apelido !== undefined) conta.apelido = dto.apelido;
    if (dto.ativa !== undefined) conta.ativa = dto.ativa;
    return this.repo.save(conta);
  }

  private ctx(conta: ContaBancaria) {
    return {
      contaBancariaId: conta.id,
      empresaId: conta.empresaId,
      credencialRef: conta.credencialRef,
    };
  }

  async consultarSaldoApi(id: string, empresaId: string, dataSaldo?: string) {
    const conta = await this.findOne(id, empresaId);
    const provider = this.bancoRegistry.resolver(conta.provedor);
    const saldo = await provider.consultarSaldo(this.ctx(conta), dataSaldo);

    if (conta.provedor === ProvedorBancario.INTER) {
      conta.saldoBanco = String(saldo.saldo);
      conta.saldoBancoEm = new Date();
      await this.repo.save(conta);
    }

    return {
      conta_id: conta.id,
      provedor: conta.provedor,
      saldo_banco: saldo.saldo,
      data_referencia: saldo.dataReferencia ?? dataSaldo,
      saldo_banco_em: conta.saldoBancoEm,
    };
  }

  async consultarExtratoApi(
    id: string,
    empresaId: string,
    de?: string,
    ate?: string,
  ) {
    const conta = await this.findOne(id, empresaId);
    const ateFim = ate ?? new Date().toISOString().slice(0, 10);
    const deInicio =
      de ??
      (conta.ultimaSincronizacao
        ? conta.ultimaSincronizacao.toISOString().slice(0, 10)
        : conta.dataSaldoInicial);

    const provider = this.bancoRegistry.resolver(conta.provedor);
    const extrato = await provider.consultarExtrato(this.ctx(conta), deInicio, ateFim);
    return {
      conta_id: conta.id,
      de: extrato.de,
      ate: extrato.ate,
      linhas: extrato.linhas,
    };
  }

  async sincronizarExtrato(id: string, empresaId: string, de?: string, ate?: string) {
    const conta = await this.findOne(id, empresaId);
    if (!conta.sincronizaExtrato) {
      throw new BadRequestException('Sincronização de extrato desativada para esta conta');
    }
    return this.sincronizacao.sincronizar(conta, { de, ate });
  }
}