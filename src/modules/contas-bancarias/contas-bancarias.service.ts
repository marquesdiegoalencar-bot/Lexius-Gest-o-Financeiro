import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { BancoProviderRegistry } from '../banco/banco-provider.registry';
import { ExtratoSincronizacaoService } from '../banco/extrato-sincronizacao.service';
import { ProvedorBancario, TipoContaBancaria } from '../../database/enums';
import { ContaBancaria } from '../../database/entities/conta-bancaria.entity';
import { CreateContaBancariaDto } from './dto/create-conta-bancaria.dto';
import { UpdateContaBancariaDto } from './dto/update-conta-bancaria.dto';

const DEPENDENCIAS_CONTA_SQL = `
  SELECT (
    EXISTS (SELECT 1 FROM movimentos_bancarios WHERE conta_bancaria_id = $1)
    OR EXISTS (SELECT 1 FROM baixas WHERE conta_bancaria_id = $1)
    OR EXISTS (SELECT 1 FROM titulos_receber WHERE conta_bancaria_id = $1)
    OR EXISTS (SELECT 1 FROM titulos_pagar WHERE conta_bancaria_id = $1)
    OR EXISTS (SELECT 1 FROM recorrencias WHERE conta_bancaria_id = $1)
    OR EXISTS (SELECT 1 FROM cobrancas_boleto WHERE conta_bancaria_id = $1)
    OR EXISTS (SELECT 1 FROM cobranca_emissao_pendente WHERE conta_bancaria_id = $1)
    OR EXISTS (SELECT 1 FROM pagamentos_bancarios WHERE conta_origem_id = $1 OR conta_destino_id = $1)
    OR EXISTS (SELECT 1 FROM repasses WHERE conta_origem_id = $1)
  ) AS bloqueado
`;

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

    if (provedor === ProvedorBancario.INTER && dto.banco_codigo !== '077') {
      throw new BadRequestException('Conta Inter deve usar banco_codigo 077');
    }

    const credencialRef = dto.credencial_ref?.trim() ?? null;
    const sincronizaExtrato = dto.sincroniza_extrato ?? provedor === ProvedorBancario.INTER;
    if (
      [ProvedorBancario.INTER, ProvedorBancario.ASAAS, ProvedorBancario.C6].includes(provedor) &&
      sincronizaExtrato &&
      !credencialRef
    ) {
      throw new BadRequestException(
        'credencial_ref é obrigatório quando o provedor usa API com sincronização',
      );
    }

    try {
      return await this.repo.save(
        this.repo.create({
          empresaId,
          apelido: dto.apelido.trim(),
          bancoCodigo: dto.banco_codigo.trim(),
          agencia: dto.agencia?.trim() || null,
          conta: dto.conta?.trim() || null,
          tipo: dto.tipo ?? TipoContaBancaria.CORRENTE,
          provedor,
          saldoInicial: String(dto.saldo_inicial ?? 0),
          dataSaldoInicial: dto.data_saldo_inicial ?? new Date().toISOString().slice(0, 10),
          sincronizaExtrato,
          credencialRef,
          chavePix: dto.chave_pix?.trim() || null,
          tipoChavePix: dto.tipo_chave_pix?.trim() || null,
        }),
      );
    } catch (e) {
      if (e instanceof QueryFailedError && String(e.message).includes('23505')) {
        throw new ConflictException(
          'Já existe conta com este banco, agência e número para a empresa.',
        );
      }
      throw e;
    }
  }

  async update(id: string, empresaId: string, dto: UpdateContaBancariaDto) {
    const conta = await this.findOne(id, empresaId);
    if (dto.apelido !== undefined) conta.apelido = dto.apelido;
    if (dto.ativa !== undefined) conta.ativa = dto.ativa;
    if (dto.chave_pix !== undefined) conta.chavePix = dto.chave_pix?.trim() ?? null;
    if (dto.tipo_chave_pix !== undefined) conta.tipoChavePix = dto.tipo_chave_pix?.trim() ?? null;
    if (dto.credencial_ref !== undefined) conta.credencialRef = dto.credencial_ref?.trim() ?? null;
    if (dto.sincroniza_extrato !== undefined) conta.sincronizaExtrato = dto.sincroniza_extrato;
    if (
      conta.sincronizaExtrato &&
      [ProvedorBancario.INTER, ProvedorBancario.ASAAS, ProvedorBancario.C6].includes(conta.provedor) &&
      !conta.credencialRef?.trim()
    ) {
      throw new BadRequestException(
        'credencial_ref é obrigatório para sincronização/API neste provedor',
      );
    }
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

  async remove(id: string, empresaId: string) {
    await this.findOne(id, empresaId);

    const [{ bloqueado }] = await this.repo.manager.query(DEPENDENCIAS_CONTA_SQL, [id]);
    if (bloqueado) {
      throw new ConflictException(
        'Não é possível excluir: a conta possui movimentos, baixas, títulos ou cobranças vinculados. Inative-a em vez de apagar.',
      );
    }

    try {
      await this.repo.delete({ id, empresaId });
    } catch (e) {
      if (e instanceof QueryFailedError && String(e.message).includes('23503')) {
        throw new ConflictException(
          'Não é possível excluir: existem registros dependentes. Inative a conta.',
        );
      }
      throw e;
    }

    return { ok: true };
  }
}