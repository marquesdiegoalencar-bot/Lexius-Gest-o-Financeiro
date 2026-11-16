import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CobrancaBoleto } from '../../database/entities/cobranca-boleto.entity';
import { ContaBancaria } from '../../database/entities/conta-bancaria.entity';
import { Pessoa } from '../../database/entities/pessoa.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { ProvedorBancario, StatusCobranca, StatusTitulo } from '../../database/enums';
import { fromMoney } from '../../common/utils/money';
import { InterCobrancaHttpService } from '../banco/inter/inter-cobranca-http.service';
import { normalizarConsultaCobrancaInter } from '../banco/inter/inter-cobranca.mapper';

@Injectable()
export class CobrancasService {
  constructor(
    private interCobranca: InterCobrancaHttpService,
    @InjectRepository(CobrancaBoleto) private cobrancas: Repository<CobrancaBoleto>,
    @InjectRepository(TituloReceber) private titulos: Repository<TituloReceber>,
    @InjectRepository(ContaBancaria) private contas: Repository<ContaBancaria>,
    @InjectRepository(Pessoa) private pessoas: Repository<Pessoa>,
  ) {}

  async emitirBoletoTitulo(tituloId: string, empresaId: string, contaBancariaId?: string) {
    const titulo = await this.titulos.findOne({ where: { id: tituloId, empresaId } });
    if (!titulo) throw new NotFoundException('Título não encontrado');
    if (![StatusTitulo.ABERTO, StatusTitulo.PARCIAL, StatusTitulo.VENCIDO].includes(titulo.status)) {
      throw new BadRequestException('Título não permite emissão de cobrança');
    }

    const contaId = contaBancariaId ?? titulo.contaBancariaId;
    if (!contaId) throw new BadRequestException('conta_bancaria_id obrigatória');
    const conta = await this.contas.findOne({ where: { id: contaId, empresaId } });
    if (!conta || conta.provedor !== ProvedorBancario.INTER) {
      throw new BadRequestException('Conta Inter obrigatória');
    }
    if (!conta.credencialRef) throw new BadRequestException('credencial_ref ausente na conta');

    const existente = await this.cobrancas.findOne({
      where: { tituloReceberId: tituloId, status: StatusCobranca.EMITIDA },
    });
    if (existente?.idExterno) {
      return { cobranca: existente, reutilizada: true };
    }

    const pessoa = titulo.pessoaId
      ? await this.pessoas.findOne({ where: { id: titulo.pessoaId } })
      : null;
    const valor = fromMoney(titulo.valorOriginal);
    const seuNumero = titulo.id.replace(/-/g, '').slice(0, 15);

    const emitirBody = {
      seuNumero,
      valorNominal: valor,
      dataVencimento: titulo.dataVencimento,
      numDiasAgenda: 60,
      pagador: {
        cpfCnpj: (pessoa?.documento ?? '00000000000').replace(/\D/g, ''),
        nome: pessoa?.nome ?? 'Pagador',
        tipoPessoa: (pessoa?.documento?.replace(/\D/g, '') ?? '').length > 11 ? 'JURIDICA' : 'FISICA',
        endereco: 'N/A',
        cidade: 'N/A',
        uf: 'AM',
        cep: '69000000',
      },
    };

    const res = await this.interCobranca.emitirCobranca(
      conta.credencialRef,
      conta.conta,
      emitirBody,
    );
    const codigo = String(res.codigoSolicitacao ?? '');
    if (!codigo) throw new BadRequestException('Inter não retornou codigoSolicitacao');

    let consultaRaw: Record<string, unknown> = {};
    try {
      consultaRaw = await this.interCobranca.consultarCobranca(conta.credencialRef, conta.conta, codigo);
    } catch {
      consultaRaw = { cobranca: { codigoSolicitacao: codigo, situacao: 'EMITIDA' } };
    }
    const norm = normalizarConsultaCobrancaInter(codigo, consultaRaw);

    const cobranca = await this.cobrancas.save(
      this.cobrancas.create({
        empresaId,
        tituloReceberId: titulo.id,
        contaBancariaId: conta.id,
        provedor: ProvedorBancario.INTER,
        idExterno: codigo,
        valor: String(valor),
        dataVencimento: titulo.dataVencimento,
        status: StatusCobranca.REGISTRADA,
        linhaDigitavel: norm.linhaDigitavel ?? null,
        codigoBarras: norm.codigoBarras ?? null,
        pixCopiaCola: norm.pixCopiaECola ?? null,
      }),
    );

    return { cobranca, reutilizada: false };
  }

  async simularPagamentoMock(
    cobrancaId: string,
    empresaId: string,
    opcoes: { valorTotalRecebido: number; juros?: number; multa?: number; desconto?: number },
  ) {
    const cobranca = await this.cobrancas.findOne({ where: { id: cobrancaId, empresaId } });
    if (!cobranca?.idExterno) throw new NotFoundException('Cobrança não encontrada');
    this.interCobranca.simularPagamentoMock(cobranca.idExterno, opcoes);
    return { ok: true };
  }
}