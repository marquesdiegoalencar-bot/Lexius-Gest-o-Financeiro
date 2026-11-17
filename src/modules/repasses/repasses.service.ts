import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { distribuirComissaoItens, valorBrutoRecebidoBaixa } from '../../common/financeiro/repasse-calculo';
import { fromMoney, roundMoney, toMoneyString } from '../../common/utils/money';
import { Baixa } from '../../database/entities/baixa.entity';
import { ContaBancaria } from '../../database/entities/conta-bancaria.entity';
import { CredorRegraRepasse } from '../../database/entities/credor-regra-repasse.entity';
import { Pessoa } from '../../database/entities/pessoa.entity';
import { RepasseItem } from '../../database/entities/repasse-item.entity';
import { Repasse } from '../../database/entities/repasse.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { OrigemTitulo, StatusRepasse } from '../../database/enums';
import { FiltroRepasseDto } from './dto/filtro-repasse.dto';
import { GerarRepasseDto } from './dto/gerar-repasse.dto';
import { AtualizarRegraRepasseDto } from './dto/atualizar-regra-repasse.dto';

const ORIGENS_COBRANCA = [OrigemTitulo.COBRANCA_ACORDO, OrigemTitulo.COBRANCA_BOLETO];

@Injectable()
export class RepassesService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Repasse) private repasses: Repository<Repasse>,
    @InjectRepository(RepasseItem) private itens: Repository<RepasseItem>,
    @InjectRepository(Baixa) private baixas: Repository<Baixa>,
    @InjectRepository(TituloReceber) private titulos: Repository<TituloReceber>,
    @InjectRepository(Pessoa) private pessoas: Repository<Pessoa>,
    @InjectRepository(ContaBancaria) private contas: Repository<ContaBancaria>,
    @InjectRepository(CredorRegraRepasse) private regras: Repository<CredorRegraRepasse>,
  ) {}

  async saldoCredor(empresaId: string, credorId: string) {
    await this.validarCredor(empresaId, credorId);
    const [row] = await this.dataSource.query(
      `SELECT empresa_id, credor_id, recebido_pendente_repasse, qtd_baixas
       FROM v_saldo_credor WHERE empresa_id = $1 AND credor_id = $2`,
      [empresaId, credorId],
    );
    return {
      credor_id: credorId,
      recebido_pendente_repasse: row
        ? Number(row.recebido_pendente_repasse)
        : 0,
      qtd_baixas: row ? Number(row.qtd_baixas) : 0,
    };
  }

  async baixasPendentes(
    empresaId: string,
    credorId: string,
    de?: string,
    ate?: string,
  ) {
    await this.validarCredor(empresaId, credorId);
    const params: unknown[] = [empresaId, credorId, ORIGENS_COBRANCA];
    let sql = `
      SELECT b.id AS baixa_id, b.data_baixa, b.valor_liquido, b.tarifa, b.forma,
             t.id AS titulo_id, t.descricao, t.cobranca_parcela_id,
             (b.valor_liquido::numeric + b.tarifa::numeric) AS valor_bruto_recebido
      FROM baixas b
      JOIN titulos_receber t ON t.id = b.titulo_receber_id
      LEFT JOIN repasse_itens ri ON ri.baixa_id = b.id
      WHERE t.empresa_id = $1 AND t.credor_id = $2
        AND t.origem = ANY($3::origem_titulo[])
        AND b.estornada = FALSE AND ri.id IS NULL`;
    if (de) {
      params.push(de);
      sql += ` AND b.data_baixa >= $${params.length}`;
    }
    if (ate) {
      params.push(ate);
      sql += ` AND b.data_baixa <= $${params.length}`;
    }
    sql += ` ORDER BY b.data_baixa, b.criada_em`;
    return this.dataSource.query(sql, params);
  }

  async listar(empresaId: string, filtros: FiltroRepasseDto) {
    const where: Record<string, unknown> = { empresaId };
    if (filtros.credor_id) where.credorId = filtros.credor_id;
    if (filtros.status) where.status = filtros.status;
    return this.repasses.find({ where, order: { criadoEm: 'DESC' }, take: 200 });
  }

  async obter(empresaId: string, id: string) {
    const repasse = await this.repasses.findOne({ where: { id, empresaId } });
    if (!repasse) throw new NotFoundException('Repasse não encontrado');
    const itens = await this.itens.find({ where: { repasseId: id } });
    return { ...repasse, itens };
  }

  async gerar(empresaId: string, usuarioId: string, dto: GerarRepasseDto) {
    await this.validarCredor(empresaId, dto.credor_id);
    const conta = await this.contas.findOne({
      where: { id: dto.conta_origem_id, empresaId, ativa: true },
    });
    if (!conta) throw new NotFoundException('Conta de origem não encontrada');

    await this.validarBaixasElegiveis(empresaId, dto.credor_id, dto.baixa_ids);

    const repasse = await this.repasses.save(
      this.repasses.create({
        empresaId,
        credorId: dto.credor_id,
        contaOrigemId: dto.conta_origem_id,
        periodoInicio: dto.periodo_inicio,
        periodoFim: dto.periodo_fim,
        percentualComissao: toMoneyString(dto.percentual_comissao),
        outrosDescontos: toMoneyString(dto.outros_descontos ?? 0),
        totalHonorarios: toMoneyString(dto.total_honorarios ?? 0),
        rascunhoBaixaIds: dto.baixa_ids,
        status: StatusRepasse.RASCUNHO,
        observacao: dto.observacao ?? null,
        criadoPor: usuarioId,
      }),
    );
    return repasse;
  }

  async calcular(empresaId: string, repasseId: string) {
    const repasse = await this.repasses.findOne({ where: { id: repasseId, empresaId } });
    if (!repasse) throw new NotFoundException('Repasse não encontrado');
    if (repasse.status !== StatusRepasse.RASCUNHO && repasse.status !== StatusRepasse.CALCULADO) {
      throw new BadRequestException('Repasse não pode ser recalculado neste status');
    }
    const baixaIds = repasse.rascunhoBaixaIds;
    if (!baixaIds?.length) {
      throw new BadRequestException('Nenhuma baixa selecionada no rascunho');
    }

    await this.validarBaixasElegiveis(empresaId, repasse.credorId, baixaIds);

    const baixas = await this.baixas.find({ where: { id: In(baixaIds), empresaId } });
    if (baixas.length !== baixaIds.length) {
      throw new BadRequestException('Baixa não encontrada');
    }

    const tituloIds = [...new Set(baixas.map((b) => b.tituloReceberId).filter(Boolean))] as string[];
    const titulos = await this.titulos.find({ where: { id: In(tituloIds) } });
    const tituloMap = new Map(titulos.map((t) => [t.id, t]));

    const pct = fromMoney(repasse.percentualComissao);
    const honorariosTotal = fromMoney(repasse.totalHonorarios);
    const brutos = baixas.map((b) => valorBrutoRecebidoBaixa(b));
    const comissoes = distribuirComissaoItens(brutos, pct);
    const honorariosItens = this.distribuirValorProporcional(brutos, honorariosTotal);

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(RepasseItem, { repasseId: repasse.id });

      let totalRecebido = 0;
      let totalComissao = 0;
      let totalHonorarios = 0;
      let totalTarifas = 0;
      let totalRepasseItens = 0;

      const ordenadas = [...baixas].sort((a, b) => a.dataBaixa.localeCompare(b.dataBaixa));

      for (let i = 0; i < ordenadas.length; i++) {
        const baixa = ordenadas[i];
        const titulo = tituloMap.get(baixa.tituloReceberId!);
        if (!titulo) throw new BadRequestException('Título da baixa não encontrado');

        const tarifa = fromMoney(baixa.tarifa);
        const comissao = comissoes[i];
        const honorarios = honorariosItens[i];
        const bruto = valorBrutoRecebidoBaixa(baixa);
        const valorRepasse = roundMoney(bruto - comissao - honorarios - tarifa);

        await manager.save(
          manager.create(RepasseItem, {
            repasseId: repasse.id,
            baixaId: baixa.id,
            tituloReceberId: titulo.id,
            valorRecebido: toMoneyString(bruto),
            comissao: toMoneyString(comissao),
            honorarios: toMoneyString(honorarios),
            tarifa: toMoneyString(tarifa),
            valorRepasse: toMoneyString(valorRepasse),
          }),
        );

        totalRecebido += bruto;
        totalComissao += comissao;
        totalHonorarios += honorarios;
        totalTarifas += tarifa;
        totalRepasseItens += valorRepasse;
      }

      const outros = fromMoney(repasse.outrosDescontos);
      const totalRepasse = roundMoney(totalRepasseItens - outros);

      repasse.totalRecebido = toMoneyString(totalRecebido);
      repasse.totalComissao = toMoneyString(totalComissao);
      repasse.totalHonorarios = toMoneyString(totalHonorarios);
      repasse.totalTarifas = toMoneyString(totalTarifas);
      repasse.totalRepasse = toMoneyString(totalRepasse);
      repasse.status = StatusRepasse.CALCULADO;
      await manager.save(repasse);

      const itens = await manager.find(RepasseItem, { where: { repasseId: repasse.id } });
      return { ...repasse, itens };
    });
  }

  async obterRegraRepasse(empresaId: string, credorId: string) {
    await this.validarCredor(empresaId, credorId);
    const regra = await this.regras.findOne({
      where: { empresaId, credorId },
      order: { vigenteDesde: 'DESC' },
    });
    const ultimoPct = await this.ultimoPercentualComissao(empresaId, credorId);
    return {
      regra: regra ?? null,
      sugestao_percentual_comissao: ultimoPct,
    };
  }

  async salvarRegraRepasse(
    empresaId: string,
    credorId: string,
    dto: AtualizarRegraRepasseDto,
  ) {
    await this.validarCredor(empresaId, credorId);
    const hoje = new Date().toISOString().slice(0, 10);
    let regra = await this.regras.findOne({
      where: { empresaId, credorId },
      order: { vigenteDesde: 'DESC' },
    });
    if (!regra || regra.vigenteDesde !== hoje) {
      regra = this.regras.create({
        empresaId,
        credorId,
        vigenteDesde: hoje,
        comissaoModo: dto.comissao_modo ?? 'MANUAL',
        percentualComissao: toMoneyString(dto.percentual_comissao ?? 0),
        percentualHonorarios: toMoneyString(dto.percentual_honorarios ?? 0),
        descontarTaxaBoleto: dto.descontar_taxa_boleto ?? true,
        descontarTaxaBancaria: dto.descontar_taxa_bancaria ?? true,
        periodicidade: dto.periodicidade ?? 'SEMANAL',
        diaRepasse: dto.dia_repasse ?? null,
        valorMinimo: toMoneyString(dto.valor_minimo ?? 0),
      });
    } else {
      if (dto.comissao_modo) regra.comissaoModo = dto.comissao_modo;
      if (dto.percentual_comissao !== undefined) {
        regra.percentualComissao = toMoneyString(dto.percentual_comissao);
      }
      if (dto.percentual_honorarios !== undefined) {
        regra.percentualHonorarios = toMoneyString(dto.percentual_honorarios);
      }
      if (dto.descontar_taxa_boleto !== undefined) regra.descontarTaxaBoleto = dto.descontar_taxa_boleto;
      if (dto.descontar_taxa_bancaria !== undefined) {
        regra.descontarTaxaBancaria = dto.descontar_taxa_bancaria;
      }
      if (dto.periodicidade) regra.periodicidade = dto.periodicidade;
      if (dto.dia_repasse !== undefined) regra.diaRepasse = dto.dia_repasse ?? null;
      if (dto.valor_minimo !== undefined) regra.valorMinimo = toMoneyString(dto.valor_minimo);
    }
    return this.regras.save(regra);
  }

  private async ultimoPercentualComissao(empresaId: string, credorId: string): Promise<number | null> {
    const [row] = await this.dataSource.query(
      `SELECT percentual_comissao FROM repasses
       WHERE empresa_id = $1 AND credor_id = $2 AND status != $3
       ORDER BY criado_em DESC LIMIT 1`,
      [empresaId, credorId, StatusRepasse.CANCELADO],
    );
    return row ? fromMoney(row.percentual_comissao) : null;
  }

  private distribuirValorProporcional(brutos: number[], total: number): number[] {
    if (!brutos.length || total <= 0) return brutos.map(() => 0);
    const sumBruto = roundMoney(brutos.reduce((s, v) => s + v, 0));
    const pct = sumBruto > 0 ? (total / sumBruto) * 100 : 0;
    return distribuirComissaoItens(brutos, pct);
  }

  private async validarCredor(empresaId: string, credorId: string) {
    const pessoa = await this.pessoas.findOne({ where: { id: credorId } });
    if (!pessoa?.ehCredor) throw new NotFoundException('Credor não encontrado');
    return pessoa;
  }

  private async validarBaixasElegiveis(
    empresaId: string,
    credorId: string,
    baixaIds: string[],
  ): Promise<void> {
    const pendentes = await this.baixasPendentes(empresaId, credorId);
    const elegiveis = new Set(pendentes.map((p: { baixa_id: string }) => p.baixa_id));
    for (const id of baixaIds) {
      if (!elegiveis.has(id)) {
        throw new ConflictException(`Baixa ${id} não elegível para repasse deste credor`);
      }
    }
  }
}