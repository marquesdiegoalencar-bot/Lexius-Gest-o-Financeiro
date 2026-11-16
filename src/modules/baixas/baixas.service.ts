import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
import { BaixarTituloDto } from './dto/baixar-titulo.dto';
import { EstornarBaixaDto } from './dto/estornar-baixa.dto';

@Injectable()
export class BaixasService {
  constructor(
    private dataSource: DataSource,
    private auditoria: AuditoriaService,
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

  private async validarConta(empresaId: string, contaId: string) {
    const conta = await this.contas.findOne({ where: { id: contaId, empresaId, ativa: true } });
    if (!conta) throw new NotFoundException('Conta bancária não encontrada');
    return conta;
  }

  async baixarTituloReceber(
    tituloId: string,
    empresaId: string,
    usuarioId: string,
    dto: BaixarTituloDto,
  ) {
    const valorLiquido = this.calcValorLiquido(dto);
    await this.validarConta(empresaId, dto.conta_bancaria_id);

    return this.dataSource.transaction(async (manager) => {
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

      const movimento = await manager.save(
        manager.create(MovimentoBancario, {
          contaBancariaId: dto.conta_bancaria_id,
          dataMovimento: dto.data_baixa,
          dataHora: new Date(),
          sentido: SentidoMovimento.CREDITO,
          valor: toMoneyString(valorLiquido),
          descricao: `Baixa título receber ${titulo.descricao}`,
          origem: OrigemMovimento.MANUAL,
          idExterno: `baixa-tr-${uuidv4()}`,
        }),
      );

      const baixa = await manager.save(
        manager.create(Baixa, {
          empresaId,
          tituloReceberId: titulo.id,
          contaBancariaId: dto.conta_bancaria_id,
          movimentoId: movimento.id,
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
      aplicarBaixaReceber(titulo, valorLiquido, dto.data_baixa);
      await manager.save(titulo);

      await this.auditoria.registrar({
        empresaId,
        usuarioId,
        entidade: 'baixa',
        entidadeId: baixa.id,
        acao: 'BAIXAR',
        antes: { titulo_id: titulo.id, status: antes.status, valor_recebido: antes.valorRecebido },
        depois: { status: titulo.status, valor_recebido: titulo.valorRecebido },
      });

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

      const movimento = await manager.save(
        manager.create(MovimentoBancario, {
          contaBancariaId: dto.conta_bancaria_id,
          dataMovimento: dto.data_baixa,
          dataHora: new Date(),
          sentido: SentidoMovimento.DEBITO,
          valor: toMoneyString(valorLiquido),
          descricao: `Baixa título pagar ${titulo.descricao}`,
          origem: OrigemMovimento.MANUAL,
          idExterno: `baixa-tp-${uuidv4()}`,
        }),
      );

      const baixa = await manager.save(
        manager.create(Baixa, {
          empresaId,
          tituloPagarId: titulo.id,
          contaBancariaId: dto.conta_bancaria_id,
          movimentoId: movimento.id,
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

      await this.auditoria.registrar({
        empresaId,
        usuarioId,
        entidade: 'baixa',
        entidadeId: baixa.id,
        acao: 'BAIXAR',
        antes: { titulo_id: titulo.id, status: antes.status, valor_pago: antes.valorPago },
        depois: { status: titulo.status, valor_pago: titulo.valorPago },
      });

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

    return this.dataSource.transaction(async (manager) => {
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

      if (baixa.movimentoId) {
        const mov = await manager.findOne(MovimentoBancario, { where: { id: baixa.movimentoId } });
        if (mov) {
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
              descricao: `Estorno baixa ${baixa.id}`,
              origem: OrigemMovimento.MANUAL,
              idExterno: `estorno-${baixa.id}-${uuidv4()}`,
            }),
          );
        }
      }

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
  }
}