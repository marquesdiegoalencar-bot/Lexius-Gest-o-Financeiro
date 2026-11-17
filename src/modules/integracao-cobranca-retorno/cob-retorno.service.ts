import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { fromMoney, saldoTituloReceber } from '../../common/utils/money';
import { Baixa } from '../../database/entities/baixa.entity';
import { CobrancaAcordo } from '../../database/entities/cobranca-acordo.entity';
import { CobRetornoEvento } from '../../database/entities/cob-retorno-evento.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { OrigemTitulo, StatusCobRetorno, StatusTitulo } from '../../database/enums';
import { CobRetornoHttpClient } from './cob-retorno-http.client';

const ORIGENS_COB = new Set<OrigemTitulo>([
  OrigemTitulo.COBRANCA_ACORDO,
  OrigemTitulo.COBRANCA_BOLETO,
]);

@Injectable()
export class CobRetornoService {
  private readonly logger = new Logger(CobRetornoService.name);
  private processando = false;

  constructor(
    private config: ConfigService,
    private http: CobRetornoHttpClient,
    @InjectRepository(CobRetornoEvento) private eventos: Repository<CobRetornoEvento>,
    @InjectRepository(Baixa) private baixas: Repository<Baixa>,
    @InjectRepository(TituloReceber) private titulos: Repository<TituloReceber>,
    @InjectRepository(CobrancaAcordo) private acordos: Repository<CobrancaAcordo>,
  ) {}

  agendarAposBaixaReceber(baixaId: string): void {
    setImmediate(() => {
      void this.enfileirarAposBaixa(baixaId).catch((err) =>
        this.logger.error(`Falha ao enfileirar retorno COB (baixa ${baixaId}): ${err}`),
      );
    });
  }

  agendarAposEstornoBaixaReceber(baixaId: string): void {
    setImmediate(() => {
      void this.enfileirarAposEstorno(baixaId).catch((err) =>
        this.logger.error(`Falha ao enfileirar retorno COB (estorno ${baixaId}): ${err}`),
      );
    });
  }

  async enfileirarAposBaixa(baixaId: string): Promise<void> {
    const ctx = await this.carregarContextoBaixa(baixaId);
    if (!ctx) return;

    const ordemTitulo = await this.proximaOrdemAcordo(ctx.codigoAcordo);
    await this.criarEventoSeNovo({
      empresaId: ctx.empresaId,
      tipoEvento: 'titulo.baixado',
      codigoAcordo: ctx.codigoAcordo,
      ordemNoAcordo: ordemTitulo,
      baixaId: ctx.baixa.id,
      tituloReceberId: ctx.titulo.id,
      idempotencyKey: `${ctx.baixa.id}:titulo.baixado`,
      payload: this.envelope('titulo.baixado', this.dadosTituloBaixado(ctx)),
    });

    const ordemAcordo = await this.proximaOrdemAcordo(ctx.codigoAcordo);
    await this.criarEventoSeNovo({
      empresaId: ctx.empresaId,
      tipoEvento: 'acordo.atualizado',
      codigoAcordo: ctx.codigoAcordo,
      ordemNoAcordo: ordemAcordo,
      baixaId: ctx.baixa.id,
      tituloReceberId: ctx.titulo.id,
      idempotencyKey: `${ctx.baixa.id}:acordo.atualizado`,
      payload: await this.envelopeAcordoAtualizado(ctx.acordo.id, ctx.codigoAcordo),
    });

    await this.processarPendentes();
  }

  async enfileirarAposEstorno(baixaId: string): Promise<void> {
    const ctx = await this.carregarContextoBaixa(baixaId);
    if (!ctx) return;

    const ordemTitulo = await this.proximaOrdemAcordo(ctx.codigoAcordo);
    await this.criarEventoSeNovo({
      empresaId: ctx.empresaId,
      tipoEvento: 'titulo.estornado',
      codigoAcordo: ctx.codigoAcordo,
      ordemNoAcordo: ordemTitulo,
      baixaId: ctx.baixa.id,
      tituloReceberId: ctx.titulo.id,
      idempotencyKey: `${ctx.baixa.id}:titulo.estornado`,
      payload: this.envelope('titulo.estornado', this.dadosTituloEstornado(ctx)),
    });

    const ordemAcordo = await this.proximaOrdemAcordo(ctx.codigoAcordo);
    await this.criarEventoSeNovo({
      empresaId: ctx.empresaId,
      tipoEvento: 'acordo.atualizado',
      codigoAcordo: ctx.codigoAcordo,
      ordemNoAcordo: ordemAcordo,
      baixaId: ctx.baixa.id,
      tituloReceberId: ctx.titulo.id,
      idempotencyKey: `${ctx.baixa.id}:acordo.atualizado:estorno`,
      payload: await this.envelopeAcordoAtualizado(ctx.acordo.id, ctx.codigoAcordo),
    });

    await this.processarPendentes();
  }

  async processarPendentes(limit = 40): Promise<number> {
    if (this.processando) return 0;
    this.processando = true;
    let enviados = 0;
    try {
      const maxTentativas = Number(this.config.get<string>('COB_RETORNO_MAX_TENTATIVAS') ?? 5);
      const candidatos = await this.eventos.find({
        where: { status: StatusCobRetorno.PENDENTE },
        order: { codigoAcordo: 'ASC', ordemNoAcordo: 'ASC', criadaEm: 'ASC' },
        take: limit,
      });

      for (const ev of candidatos) {
        if (ev.tentativas >= maxTentativas) {
          ev.status = StatusCobRetorno.FALHOU;
          ev.ultimoErro = ev.ultimoErro ?? 'Limite de tentativas atingido';
          await this.eventos.save(ev);
          continue;
        }
        if (ev.codigoAcordo && !(await this.podeEnviarNoAcordo(ev))) {
          continue;
        }
        const rawBody = JSON.stringify(ev.payload);
        const result = await this.http.postJson(rawBody);
        ev.tentativas += 1;
        if (result.ok) {
          ev.status = StatusCobRetorno.ENVIADO;
          ev.enviadoEm = new Date();
          ev.ultimoErro = null;
          ev.httpStatus = result.status;
          enviados += 1;
        } else {
          ev.httpStatus = result.status ?? null;
          ev.ultimoErro = result.erro;
          if (ev.tentativas >= maxTentativas) {
            ev.status = StatusCobRetorno.FALHOU;
          }
        }
        await this.eventos.save(ev);
      }
    } finally {
      this.processando = false;
    }
    return enviados;
  }

  async listarFalhas(empresaId: string, take = 100): Promise<CobRetornoEvento[]> {
    return this.eventos.find({
      where: { empresaId, status: StatusCobRetorno.FALHOU },
      order: { criadaEm: 'DESC' },
      take,
    });
  }

  async reenviarManual(eventoId: string, empresaId: string): Promise<CobRetornoEvento> {
    const ev = await this.eventos.findOne({ where: { id: eventoId, empresaId } });
    if (!ev) throw new NotFoundException('Evento não encontrado');
    if (ev.status !== StatusCobRetorno.FALHOU) {
      throw new NotFoundException('Somente eventos com status FALHOU podem ser reenviados');
    }
    ev.status = StatusCobRetorno.PENDENTE;
    ev.tentativas = 0;
    ev.ultimoErro = null;
    ev.httpStatus = null;
    await this.eventos.save(ev);
    await this.processarPendentes();
    return ev;
  }

  private async podeEnviarNoAcordo(ev: CobRetornoEvento): Promise<boolean> {
    if (!ev.codigoAcordo) return true;

    const bloqueador = await this.eventos
      .createQueryBuilder('e')
      .where('e.codigo_acordo = :codigo', { codigo: ev.codigoAcordo })
      .andWhere('e.ordem_no_acordo < :ordem', { ordem: ev.ordemNoAcordo })
      .andWhere('e.status != :enviado', { enviado: StatusCobRetorno.ENVIADO })
      .getCount();
    return bloqueador === 0;
  }

  private async proximaOrdemAcordo(codigoAcordo: string): Promise<number> {
    const row = await this.eventos
      .createQueryBuilder('e')
      .select('COALESCE(MAX(e.ordem_no_acordo), 0)', 'max')
      .where('e.codigo_acordo = :codigo', { codigo: codigoAcordo })
      .getRawOne<{ max: string }>();
    return Number(row?.max ?? 0) + 1;
  }

  private async criarEventoSeNovo(dados: {
    empresaId: string;
    tipoEvento: string;
    codigoAcordo: string;
    ordemNoAcordo: number;
    baixaId: string;
    tituloReceberId: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const existente = await this.eventos.findOne({
      where: { idempotencyKey: dados.idempotencyKey },
    });
    if (existente) return;
    const id = uuidv4();
    const payload = { ...dados.payload, evento_id: id };
    await this.eventos.save(
      this.eventos.create({
        id,
        ...dados,
        payload,
        status: StatusCobRetorno.PENDENTE,
        tentativas: 0,
      }),
    );
  }

  private envelope(tipo: string, dados: Record<string, unknown>): Record<string, unknown> {
    return {
      tipo,
      gerado_em: new Date().toISOString(),
      versao: 2,
      dados,
    };
  }

  private async envelopeAcordoAtualizado(
    acordoId: string,
    codigoAcordo: string,
  ): Promise<Record<string, unknown>> {
    const dados = await this.montarDadosAcordoAtualizado(acordoId, codigoAcordo);
    return this.envelope('acordo.atualizado', dados);
  }

  private async montarDadosAcordoAtualizado(acordoId: string, codigoAcordo: string) {
    const acordo = await this.acordos.findOneOrFail({ where: { id: acordoId } });
    const titulos = await this.titulos.find({
      where: { acordoId },
      order: { parcelaNumero: 'ASC' },
    });
    const parcelas = titulos.map((t) => {
      const saldo = saldoTituloReceber(t);
      return {
        id_parcela: t.cobrancaParcelaId,
        numero: t.parcelaNumero,
        tipo_parcela: t.tipoParcela,
        status: t.status,
        valor_original: fromMoney(t.valorOriginal),
        valor_recebido: fromMoney(t.valorRecebido),
        saldo,
        data_vencimento: t.dataVencimento,
        data_pagamento: t.dataPagamento,
      };
    });
    const valorRecebidoTotal = titulos.reduce((s, t) => s + fromMoney(t.valorRecebido), 0);
    const statusPagamento = this.statusPagamentoAcordo(titulos);
    return {
      codigo_acordo: codigoAcordo,
      status_pagamento_financeiro: statusPagamento,
      valor_acordado: fromMoney(acordo.valorAcordado),
      valor_recebido_total: Math.round(valorRecebidoTotal * 100) / 100,
      parcelas,
    };
  }

  private statusPagamentoAcordo(titulos: TituloReceber[]): string {
    const abertos = titulos.filter(
      (t) => t.status !== StatusTitulo.PAGO && t.status !== StatusTitulo.CANCELADO,
    );
    if (abertos.length === 0 && titulos.length > 0) return 'QUITADO';
    const algumPago = titulos.some((t) => fromMoney(t.valorRecebido) > 0.009);
    if (algumPago) return 'PARCIAL';
    return 'EM_ABERTO';
  }

  private dadosTituloBaixado(ctx: ContextoBaixaCob) {
    const saldo = saldoTituloReceber(ctx.titulo);
    return {
      codigo_acordo: ctx.codigoAcordo,
      id_parcela: ctx.titulo.cobrancaParcelaId,
      titulo_financeiro_id: ctx.titulo.id,
      baixa_id: ctx.baixa.id,
      valor_recebido: fromMoney(ctx.titulo.valorRecebido),
      valor_liquido: fromMoney(ctx.baixa.valorLiquido),
      data_baixa: ctx.baixa.dataBaixa,
      forma: ctx.baixa.forma,
      automatica: ctx.baixa.automatica,
      status_titulo: ctx.titulo.status,
      saldo_parcela: saldo,
    };
  }

  private dadosTituloEstornado(ctx: ContextoBaixaCob) {
    const saldo = saldoTituloReceber(ctx.titulo);
    return {
      codigo_acordo: ctx.codigoAcordo,
      id_parcela: ctx.titulo.cobrancaParcelaId,
      titulo_financeiro_id: ctx.titulo.id,
      baixa_id: ctx.baixa.id,
      motivo_estorno: ctx.baixa.motivoEstorno,
      estornado_em: ctx.baixa.estornadaEm?.toISOString() ?? null,
      valor_liquido_estornado: fromMoney(ctx.baixa.valorLiquido),
      status_titulo: ctx.titulo.status,
      saldo_parcela: saldo,
    };
  }

  private async carregarContextoBaixa(baixaId: string): Promise<ContextoBaixaCob | null> {
    const baixa = await this.baixas.findOne({ where: { id: baixaId } });
    if (!baixa?.tituloReceberId) return null;

    const titulo = await this.titulos.findOne({ where: { id: baixa.tituloReceberId } });
    if (!titulo || !titulo.cobrancaParcelaId || !ORIGENS_COB.has(titulo.origem)) {
      return null;
    }

    const acordoId = titulo.acordoId;
    if (!acordoId) return null;
    const acordo = await this.acordos.findOne({ where: { id: acordoId } });
    if (!acordo) return null;

    return {
      empresaId: baixa.empresaId,
      baixa,
      titulo,
      acordo,
      codigoAcordo: acordo.codigo,
    };
  }
}

type ContextoBaixaCob = {
  empresaId: string;
  baixa: Baixa;
  titulo: TituloReceber;
  acordo: CobrancaAcordo;
  codigoAcordo: string;
};