import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContaBancaria } from '../../database/entities/conta-bancaria.entity';
import { MovimentoBancario } from '../../database/entities/movimento-bancario.entity';
import { OrigemMovimento, SentidoMovimento } from '../../database/enums';
import { BancoProviderRegistry } from './banco-provider.registry';
import { LinhaExtratoBanco } from './banco-provider.types';

export type ResultadoSincronizacao = {
  inseridos: number;
  ignorados: number;
  de: string;
  ate: string;
  saldoBanco?: number;
};

@Injectable()
export class ExtratoSincronizacaoService {
  constructor(
    private registry: BancoProviderRegistry,
    @InjectRepository(MovimentoBancario)
    private movRepo: Repository<MovimentoBancario>,
    @InjectRepository(ContaBancaria) private contaRepo: Repository<ContaBancaria>,
  ) {}

  private contexto(conta: ContaBancaria) {
    return {
      contaBancariaId: conta.id,
      empresaId: conta.empresaId,
      credencialRef: conta.credencialRef,
    };
  }

  private dataInicioIncremental(conta: ContaBancaria): string {
    if (conta.ultimaSincronizacao) {
      return conta.ultimaSincronizacao.toISOString().slice(0, 10);
    }
    return conta.dataSaldoInicial;
  }

  async sincronizar(
    conta: ContaBancaria,
    opcoes?: { de?: string; ate?: string },
  ): Promise<ResultadoSincronizacao> {
    const ate = opcoes?.ate ?? new Date().toISOString().slice(0, 10);
    const de = opcoes?.de ?? this.dataInicioIncremental(conta);

    const provider = this.registry.resolver(conta.provedor);
    const ctx = this.contexto(conta);
    const extrato = await provider.consultarExtrato(ctx, de, ate);

    let inseridos = 0;
    let ignorados = 0;
    for (const linha of extrato.linhas) {
      const ok = await this.inserirLinhaSeNova(conta.id, linha);
      if (ok) inseridos += 1;
      else ignorados += 1;
    }

    let saldoBanco: number | undefined;
    try {
      const saldo = await provider.consultarSaldo(ctx, ate);
      saldoBanco = saldo.saldo;
      conta.saldoBanco = String(saldo.saldo);
      conta.saldoBancoEm = new Date();
    } catch {
      /* saldo opcional se API indisponível */
    }

    conta.ultimaSincronizacao = new Date();
    await this.contaRepo.save(conta);

    return { inseridos, ignorados, de, ate, saldoBanco };
  }

  private async inserirLinhaSeNova(
    contaId: string,
    linha: LinhaExtratoBanco,
  ): Promise<boolean> {
    if (!linha.idExterno) return false;

    const existe = await this.movRepo.exists({
      where: { contaBancariaId: contaId, idExterno: linha.idExterno },
    });
    if (existe) return false;

    await this.movRepo.save(
      this.movRepo.create({
        contaBancariaId: contaId,
        dataMovimento: linha.dataMovimento,
        sentido: linha.sentido as SentidoMovimento,
        valor: String(linha.valor),
        descricao: linha.descricao ?? null,
        contraparteNome: linha.contraparteNome ?? null,
        contraparteDocumento: linha.contraparteDocumento ?? null,
        tipoTransacao: linha.tipoTransacao ?? null,
        origem: OrigemMovimento.API_BANCO,
        idExterno: linha.idExterno,
        conciliado: false,
      }),
    );
    return true;
  }
}