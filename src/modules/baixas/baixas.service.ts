import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import {
  aplicarBaixaPagar,
  aplicarBaixaReceber,
  aplicarEstornoPagar,
  aplicarEstornoReceber,
} from '../../common/financeiro/titulo-status';
import { fromMoney, roundMoney, saldoTituloPagar, saldoTituloReceber, toMoneyString } from '../../common/utils/money';
import { Baixa } from '../../database/entities/baixa.entity';
import { ContaBancaria } from '../../database/entities/conta-bancaria.entity';
import { MovimentoBancario } from '../../database/entities/movimento-bancario.entity';
import { TituloPagar } from '../../database/entities/titulo-pagar.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import {
  OrigemMovimento,
  PapelUsuario,
  SentidoMovimento,
  StatusAprovacaoTituloPagar,
  StatusTitulo,
} from '../../database/enums';
import { CobRetornoService } from '../integracao-cobranca-retorno/cob-retorno.service';
import { RateioBaixaService } from '../rateio/rateio-baixa.service';
import { BaixarTituloDto } from './dto/baixar-titulo.dto';
import { EstornarBaixaDto } from './dto/estornar-baixa.dto';

@Injectable()
export class BaixasService {
  constructor(
    private dataSource: DataSource,
    private auditoria: AuditoriaService,
    private cobRetorno: CobRetornoService,
    private rateioBaixa: RateioBaixaService,
    @InjectRepository(Baixa) private baixas: Repository<Baixa>,
    @InjectRepository(TituloReceber) private titulosReceber: Repository<TituloReceber>,
    @InjectRepository(TituloPagar) private titulosPagar: Repository<TituloPagar>,
    @InjectRepository(ContaBancaria) private contas: Repository<ContaBancaria>,
  ) {}

  private calcValorLiquido(dto: BaixarTituloDto): number {
    const liquido =
      dto.valor_principal +
      (dto.juros ?? 0) +
      (dto.multa ?? 0) -
      (dto.desconto ?? 0) -
      (dto.tarifa ?? 0);
    if (liquido <= 0) {
      throw new BadRequestException('valor_liquido deve ser positivo');
    }
    return roundMoney(liquido);
  }

  private valorBrutoMovimento(dto: BaixarTituloDto): number {
    const bruto =
      dto.valor_principal + (dto.juros ?? 0) + (dto.multa ?? 0) - (dto.desconto ?? 0);
    if (bruto <= 0) {
      throw new BadRequestException('Valor bruto da baixa deve ser positivo');
    }
    return roundMoney(bruto);
  }

  private async validarConta(empresaId: string, contaId: string) {
    const conta = await this.contas.findOne({ where: { id: contaId, empresaId, ativa: true } });
    if (!conta) throw new NotFoundException('Conta bancária não encontrada');
    return conta;
  }

  private async criarMovimentosBaixa(
    manager: EntityManager,
    params: {
      baixaId: string;
      contaBancariaId: string;
      dataBaixa: string;
      dto: BaixarTituloDto;
      sentidoPrincipal: SentidoMovimento;
      sentidoTarifa: SentidoMovimento;
      descricaoBase: string;
      origemMovimento?: OrigemMovimento;
    },
  ): Promise<{ movimentoId: string; movimentoTarifaId: string | null }> {
    const origem = params.origemMovimento ?? OrigemMovimento.MANUAL;
    const bruto = this.valorBrutoMovimento(params.dto);
    const tarifa = roundMoney(params.dto.tarifa ?? 0);

    const principal = await manager.save(
      manager.create(MovimentoBancario, {
        contaBancariaId: params.contaBancariaId,
        dataMovimento: params.dataBaixa,
        dataHora: new Date(),
        sentido: params.sentidoPrincipal,
        valor: toMoneyString(bruto),
        descricao: params.descricaoBase,
        tipoTransacao: 'BAIXA',
        origem,
        idExterno: `baixa-${params.baixaId}-principal`,
      }),
    );

    let movimentoTarifaId: string | null = null;
    if (tarifa > 0) {
      const movTarifa = await manager.save(
        manager.create(MovimentoBancario, {
          contaBancariaId: params.contaBancariaId,
          dataMovimento: params.dataBaixa,
          dataHora: new Date(),
          sentido: params.sentidoTarifa,
          valor: toMoneyString(tarifa),
          descricao: `Tarifa — ${params.descricaoBase}`,
          tipoTransacao: 'TARIFA',
          origem,
          idExterno: `baixa-${params.baixaId}-tarifa`,
        }),
      );
      movimentoTarifaId = movTarifa.id;
    }

    return { movimentoId: principal.id, movimentoTarifaId };
  }

  private async estornarMovimentosBaixa(manager: EntityManager, baixa: Baixa) {
    const ids = [baixa.movimentoId, baixa.movimentoTarifaId].filter(Boolean) as string[];
    for (const movId of ids) {
      const mov = await manager.findOne(MovimentoBancario, { where: { id: movId } });
      if (!mov) continue;
      await manager.save(
        manager.create(MovimentoBancario, {
          contaBancariaId: mov.contaBancariaId,
          dataMovimento: new Date().toISOString().slice(0, 10),
          dataHora: new Date(),
          sentido:
            mov.sentido === SentidoMovimento.CREDITO
              ? SentidoMovimento.DEBITO
              : SentidoMovimento.CREDITO,
          valor: mov.valor,
          descricao: `Estorno ${mov.tipoTransacao ?? 'movimento'} baixa ${baixa.id}`,
          tipoTransacao: mov.tipoTransacao ? `ESTORNO_${mov.tipoTransacao}` : 'ESTORNO',
          origem: OrigemMovimento.MANUAL,
          idExterno: `estorno-${baixa.id}-${mov.id}-${uuidv4()}`,
        }),
      );
    }
  }

  async baixarTituloReceber(
    tituloId: string,
    empresaId: string,
    usuarioId: string,
    dto: BaixarTituloDto,
    opcoes?: {
      automatica?: boolean;
      origemEventoId?: string;
      origemMovimento?: OrigemMovimento;
    },
  ) {
    const valorLiquido = this.calcValorLiquido(dto);
    await this.validarConta(empresaId, dto.conta_bancaria_id);

    const resultado = await this.executarBaixaReceber(
      tituloId,
      empresaId,
      usuarioId,
      dto,
      valorLiquido,
      opcoes,
    );
    if (!resultado.idempotente) {
      this.cobRetorno.agendarAposBaixaReceber(resultado.baixa.id);
    }
    return resultado;
  }

  /** Baixa automática (webhook/job) reutiliza o mesmo núcleo da baixa manual. */
  async baixarTituloReceberAutomatico(
    tituloId: string,
    empresaId: string,
    dto: BaixarTituloDto,
    origemEventoId: string,
  ) {
    const valorLiquido = this.calcValorLiquido(dto);
    const bruto = this.valorBrutoMovimento(dto);
    const resultado = await this.executarBaixaReceber(tituloId, empresaId, null, dto, valorLiquido, {
      automatica: true,
      origemEventoId,
      origemMovimento: OrigemMovimento.API_BANCO,
      valorCreditadoTitulo: bruto,
    });
    if (!resultado.idempotente) {
      this.cobRetorno.agendarAposBaixaReceber(resultado.baixa.id);
    }
    return resultado;
  }

  private async executarBaixaReceber(
    tituloId: string,
    empresaId: string,
    usuarioId: string | null,
    dto: BaixarTituloDto,
    valorLiquido: number,
    opcoes?: {
      automatica?: boolean;
      origemEventoId?: string;
      origemMovimento?: OrigemMovimento;
      valorCreditadoTitulo?: number;
    },
  ) {
    return this.dataSource.transaction(async (manager) => {
      if (opcoes?.origemEventoId) {
        const dup = await manager.findOne(Baixa, {
          where: { origemEventoId: opcoes.origemEventoId, empresaId, estornada: false },
        });
        if (dup) {
          const titulo = await manager.findOne(TituloReceber, { where: { id: tituloId, empresaId } });
          return { baixa: dup, titulo, movimento: null, idempotente: true };
        }
      }

      const titulo = await manager.findOne(TituloReceber, {
        where: { id: tituloId, empresaId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!titulo) throw new NotFoundException('Título a receber não encontrado');
      if (titulo.status === StatusTitulo.CANCELADO || titulo.status === StatusTitulo.PAGO) {
        throw new BadRequestException('Título não pode ser baixado');
      }
      const saldo = saldoTituloReceber(titulo);
      if (valorLiquido - saldo > 0.009) {
        throw new BadRequestException('Valor da baixa excede saldo em aberto');
      }

      const baixaId = uuidv4();
      const { movimentoId, movimentoTarifaId } = await this.criarMovimentosBaixa(manager, {
        baixaId,
        contaBancariaId: dto.conta_bancaria_id,
        dataBaixa: dto.data_baixa,
        dto,
        sentidoPrincipal: SentidoMovimento.CREDITO,
        sentidoTarifa: SentidoMovimento.DEBITO,
        descricaoBase: `Baixa título receber ${titulo.descricao}`,
        origemMovimento: opcoes?.origemMovimento,
      });

      const baixa = await manager.save(
        manager.create(Baixa, {
          id: baixaId,
          empresaId,
          tituloReceberId: titulo.id,
          contaBancariaId: dto.conta_bancaria_id,
          movimentoId,
          movimentoTarifaId,
          dataBaixa: dto.data_baixa,
          valorPrincipal: toMoneyString(dto.valor_principal),
          juros: toMoneyString(dto.juros ?? 0),
          multa: toMoneyString(dto.multa ?? 0),
          desconto: toMoneyString(dto.desconto ?? 0),
          tarifa: toMoneyString(dto.tarifa ?? 0),
          valorLiquido: toMoneyString(valorLiquido),
          forma: dto.forma,
          observacao: dto.observacao ?? null,
          automatica: opcoes?.automatica ?? false,
          origemEventoId: opcoes?.origemEventoId ?? null,
          criadaPor: usuarioId,
        }),
      );

      const antes = { ...titulo };
      aplicarBaixaReceber(titulo, valorLiquido, dto.data_baixa, opcoes?.valorCreditadoTitulo);
      await manager.save(titulo);

      await this.rateioBaixa.criarAposBaixa(manager, baixa, titulo);

      await this.auditoria.registrar({
        empresaId,
        usuarioId: usuarioId ?? undefined,
        entidade: 'baixa',
        entidadeId: baixa.id,
        acao: opcoes?.automatica ? 'BAIXAR_AUTOMATICA' : 'BAIXAR',
        antes: { titulo_id: titulo.id, status: antes.status, valor_recebido: antes.valorRecebido },
        depois: { status: titulo.status, valor_recebido: titulo.valorRecebido },
      });

      const movimento = await manager.findOne(MovimentoBancario, { where: { id: movimentoId } });
      return { baixa, titulo, movimento };
    });
  }

  async baixarTituloPagar(
    tituloId: string,
    empresaId: string,
    usuarioId: string,
    papel: PapelUsuario,
    dto: BaixarTituloDto,
  ) {
    if (papel !== PapelUsuario.MASTER) {
      throw new ForbiddenException('Somente MASTER pode baixar título a pagar');
    }
    const valorLiquido = this.calcValorLiquido(dto);
    await this.validarConta(empresaId, dto.conta_bancaria_id);

    return this.dataSource.transaction(async (manager) => {
      const titulo = await manager.findOne(TituloPagar, {
        where: { id: tituloId, empresaId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!titulo) throw new NotFoundException('Título a pagar não encontrado');
      if (titulo.statusAprovacao !== StatusAprovacaoTituloPagar.APROVADO) {
        throw new BadRequestException('Título precisa estar aprovado para baixa');
      }
      if (titulo.status === StatusTitulo.CANCELADO || titulo.status === StatusTitulo.PAGO) {
        throw new BadRequestException('Título não pode ser baixado');
      }
      const saldo = saldoTituloPagar(titulo);
      if (valorLiquido - saldo > 0.009) {
        throw new BadRequestException('Valor da baixa excede saldo em aberto');
      }

      const baixaId = uuidv4();
      const { movimentoId, movimentoTarifaId } = await this.criarMovimentosBaixa(manager, {
        baixaId,
        contaBancariaId: dto.conta_bancaria_id,
        dataBaixa: dto.data_baixa,
        dto,
        sentidoPrincipal: SentidoMovimento.DEBITO,
        sentidoTarifa: SentidoMovimento.DEBITO,
        descricaoBase: `Baixa título pagar ${titulo.descricao}`,
      });

      const baixa = await manager.save(
        manager.create(Baixa, {
          id: baixaId,
          empresaId,
          tituloPagarId: titulo.id,
          contaBancariaId: dto.conta_bancaria_id,
          movimentoId,
          movimentoTarifaId,
          dataBaixa: dto.data_baixa,
          valorPrincipal: toMoneyString(dto.valor_principal),
          juros: toMoneyString(dto.juros ?? 0),
          multa: toMoneyString(dto.multa ?? 0),
          desconto: toMoneyString(dto.desconto ?? 0),
          tarifa: toMoneyString(dto.tarifa ?? 0),
          valorLiquido: toMoneyString(valorLiquido),
          forma: dto.forma,
          observacao: dto.observacao ?? null,
          criadaPor: usuarioId,
        }),
      );

      const antes = { ...titulo };
      aplicarBaixaPagar(titulo, valorLiquido, dto.data_baixa);
      await manager.save(titulo);

      await this.rateioBaixa.criarAposBaixa(manager, baixa, titulo);

      await this.auditoria.registrar({
        empresaId,
        usuarioId,
        entidade: 'baixa',
        entidadeId: baixa.id,
        acao: 'BAIXAR',
        antes: { titulo_id: titulo.id, status: antes.status, valor_pago: antes.valorPago },
        depois: { status: titulo.status, valor_pago: titulo.valorPago },
      });

      const movimento = await manager.findOne(MovimentoBancario, { where: { id: movimentoId } });
      return { baixa, titulo, movimento };
    });
  }

  async estornar(
    baixaId: string,
    empresaId: string,
    usuarioId: string,
    papel: PapelUsuario,
    dto: EstornarBaixaDto,
  ) {
    if (papel !== PapelUsuario.MASTER) {
      throw new ForbiddenException('Somente MASTER pode estornar baixa');
    }

    const baixaEstornada = await this.dataSource.transaction(async (manager) => {
      const baixa = await manager.findOne(Baixa, {
        where: { id: baixaId, empresaId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!baixa) throw new NotFoundException('Baixa não encontrada');
      if (baixa.estornada) throw new BadRequestException('Baixa já estornada');

      const repasse = await manager.query(
        `SELECT id FROM repasse_itens WHERE baixa_id = $1 LIMIT 1`,
        [baixa.id],
      );
      if (repasse.length) {
        throw new BadRequestException('Baixa vinculada a repasse não pode ser estornada');
      }

      const valorLiquido = fromMoney(baixa.valorLiquido);
      const antesBaixa = { estornada: baixa.estornada };

      if (baixa.tituloReceberId) {
        const titulo = await manager.findOne(TituloReceber, {
          where: { id: baixa.tituloReceberId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!titulo) throw new NotFoundException('Título a receber não encontrado');
        aplicarEstornoReceber(titulo, valorLiquido);
        await manager.save(titulo);
      } else if (baixa.tituloPagarId) {
        const titulo = await manager.findOne(TituloPagar, {
          where: { id: baixa.tituloPagarId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!titulo) throw new NotFoundException('Título a pagar não encontrado');
        aplicarEstornoPagar(titulo, valorLiquido);
        await manager.save(titulo);
      }

      await this.estornarMovimentosBaixa(manager, baixa);
      await this.rateioBaixa.criarEstornoAlocacao(manager, baixa);

      baixa.estornada = true;
      baixa.estornadaEm = new Date();
      baixa.estornadaPor = usuarioId;
      baixa.motivoEstorno = dto.motivo;
      await manager.save(baixa);

      await this.auditoria.registrar({
        empresaId,
        usuarioId,
        entidade: 'baixa',
        entidadeId: baixa.id,
        acao: 'ESTORNAR',
        antes: antesBaixa,
        depois: { estornada: true, motivo: dto.motivo },
      });

      return baixa;
    });

    if (baixaEstornada.tituloReceberId) {
      setImmediate(() => this.cobRetorno.agendarAposEstornoBaixaReceber(baixaEstornada.id));
    }
    return baixaEstornada;
  }
}