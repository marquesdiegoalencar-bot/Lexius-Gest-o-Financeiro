import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { gerarTxidCobv } from '../../common/utils/cobv-txid';
import { soDigitos } from '../../common/utils/documento';
import { fromMoney } from '../../common/utils/money';
import { CobrancaBoleto } from '../../database/entities/cobranca-boleto.entity';
import { CobrancaEmissaoPendente } from '../../database/entities/cobranca-emissao-pendente.entity';
import { ContaBancaria } from '../../database/entities/conta-bancaria.entity';
import { Pessoa } from '../../database/entities/pessoa.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import {
  FormaPagamento,
  ModalidadeCobranca,
  ProvedorBancario,
  StatusCobranca,
  StatusTitulo,
} from '../../database/enums';
import { InterCobrancaHttpService } from '../banco/inter/inter-cobranca-http.service';
import { normalizarConsultaCobrancaInter } from '../banco/inter/inter-cobranca.mapper';
import { InterPixCobvHttpService } from '../banco/inter/inter-pix-cobv-http.service';
import { montarBodyPutCobv, normalizarConsultaCobvInter } from '../banco/inter/inter-pix-cobv.mapper';

const STATUS_COBRANCA_ATIVA = [StatusCobranca.EMITIDA, StatusCobranca.REGISTRADA];

@Injectable()
export class CobrancasService {
  private readonly logger = new Logger(CobrancasService.name);

  constructor(
    private config: ConfigService,
    private interCobranca: InterCobrancaHttpService,
    private interPixCobv: InterPixCobvHttpService,
    @InjectRepository(CobrancaBoleto) private cobrancas: Repository<CobrancaBoleto>,
    @InjectRepository(CobrancaEmissaoPendente)
    private emissaoPendentes: Repository<CobrancaEmissaoPendente>,
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
    const conta = await this.validarContaInter(contaId, empresaId, false);

    const existente = await this.cobrancas.findOne({
      where: {
        tituloReceberId: tituloId,
        modalidade: ModalidadeCobranca.COBRANCA_V3,
        status: In(STATUS_COBRANCA_ATIVA),
      },
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

    const res = await this.interCobranca.emitirCobranca(conta.credencialRef!, conta.conta, emitirBody);
    const codigo = String(res.codigoSolicitacao ?? '');
    if (!codigo) throw new BadRequestException('Inter não retornou codigoSolicitacao');

    let consultaRaw: Record<string, unknown> = {};
    try {
      consultaRaw = await this.interCobranca.consultarCobranca(conta.credencialRef!, conta.conta, codigo);
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
        modalidade: ModalidadeCobranca.COBRANCA_V3,
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

  async emitirPixCobvTitulo(
    tituloId: string,
    empresaId: string,
    contaBancariaId?: string,
    opcoes?: { reemitir?: boolean },
  ) {
    const titulo = await this.titulos.findOne({ where: { id: tituloId, empresaId } });
    if (!titulo) throw new NotFoundException('Título não encontrado');
    if (![StatusTitulo.ABERTO, StatusTitulo.PARCIAL, StatusTitulo.VENCIDO].includes(titulo.status)) {
      throw new BadRequestException('Título não permite emissão de Pix cobv');
    }

    const contaId = contaBancariaId ?? titulo.contaBancariaId;
    if (!contaId) throw new BadRequestException('conta_bancaria_id obrigatória');
    const conta = await this.validarContaInter(contaId, empresaId, true);

    const pessoa = titulo.pessoaId
      ? await this.pessoas.findOne({ where: { id: titulo.pessoaId } })
      : null;
    this.validarDevedor(pessoa);

    const ativa = await this.cobrancas.findOne({
      where: {
        tituloReceberId: tituloId,
        modalidade: ModalidadeCobranca.PIX_COBV,
        status: In(STATUS_COBRANCA_ATIVA),
      },
    });
    if (ativa?.idExterno && !opcoes?.reemitir) {
      await this.resolverEmissaoPendente(tituloId, ModalidadeCobranca.PIX_COBV);
      return { cobranca: ativa, reutilizada: true };
    }

    if (opcoes?.reemitir && ativa) {
      throw new BadRequestException('Existe cobv ativa; cancele ou aguarde expiração antes de reemitir');
    }

    const anteriores = await this.cobrancas.count({
      where: { tituloReceberId: tituloId, modalidade: ModalidadeCobranca.PIX_COBV },
    });
    const txid = gerarTxidCobv(titulo.id, String(anteriores));
    const valor = fromMoney(titulo.valorOriginal);
    const doc = soDigitos(pessoa!.documento)!;

    const body = montarBodyPutCobv({
      txid,
      chavePix: conta.chavePix!,
      valor,
      dataVencimento: titulo.dataVencimento,
      devedorNome: pessoa!.nome,
      devedorCpfCnpj: doc,
      solicitacaoPagador: titulo.descricao,
    });

    await this.interPixCobv.criarCobv(conta.credencialRef!, conta.conta, txid, body);

    let consultaRaw: Record<string, unknown> = {};
    try {
      consultaRaw = await this.interPixCobv.consultarCobv(conta.credencialRef!, conta.conta, txid);
    } catch {
      consultaRaw = { txid, status: 'ATIVA' };
    }
    const norm = normalizarConsultaCobvInter(txid, consultaRaw);

    const cobranca = await this.cobrancas.save(
      this.cobrancas.create({
        empresaId,
        tituloReceberId: titulo.id,
        contaBancariaId: conta.id,
        provedor: ProvedorBancario.INTER,
        modalidade: ModalidadeCobranca.PIX_COBV,
        idExterno: txid,
        txid,
        valor: String(valor),
        dataVencimento: titulo.dataVencimento,
        status: StatusCobranca.REGISTRADA,
        pixCopiaCola: norm.pixCopiaECola,
      }),
    );

    await this.resolverEmissaoPendente(titulo.id, ModalidadeCobranca.PIX_COBV);
    return { cobranca, reutilizada: false, txid };
  }

  async reemitirPixCobvTitulo(tituloId: string, empresaId: string, contaBancariaId?: string) {
    const ultima = await this.cobrancas.findOne({
      where: { tituloReceberId: tituloId, modalidade: ModalidadeCobranca.PIX_COBV },
      order: { criadaEm: 'DESC' },
    });
    if (!ultima || ultima.status !== StatusCobranca.EXPIRADA) {
      throw new BadRequestException(
        'Reemissão exige cobv anterior EXPIRADA (vencida e fora do prazo de pagamento)',
      );
    }
    return this.emitirPixCobvTitulo(tituloId, empresaId, contaBancariaId, { reemitir: true });
  }

  async emitirCobvParaTitulos(titulos: TituloReceber[], empresaId: string, contaBancariaId: string) {
    const emissoes: Array<{ titulo_id: string; reutilizada: boolean; cobranca_id?: string; erro?: string }> = [];
    for (const titulo of titulos) {
      if (titulo.formaPrevista !== FormaPagamento.PIX) continue;
      try {
        const res = await this.emitirPixCobvTitulo(titulo.id, empresaId, contaBancariaId);
        emissoes.push({
          titulo_id: titulo.id,
          reutilizada: res.reutilizada,
          cobranca_id: res.cobranca.id,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'ERRO_EMISSAO';
        this.logger.warn(`Emissão cobv titulo ${titulo.id}: ${msg}`);
        await this.registrarEmissaoPendente({
          empresaId,
          tituloReceberId: titulo.id,
          contaBancariaId,
          modalidade: ModalidadeCobranca.PIX_COBV,
          erro: msg,
        });
        emissoes.push({ titulo_id: titulo.id, reutilizada: false, erro: msg });
      }
    }
    return emissoes;
  }

  async processarEmissaoPendentes(limit = 30): Promise<{ processados: number; resolvidos: number }> {
    const pendentes = await this.emissaoPendentes.find({
      where: { resolvidaEm: IsNull() },
      take: limit,
      order: { criadaEm: 'ASC' },
    });
    let resolvidos = 0;
    for (const p of pendentes) {
      p.tentativas += 1;
      try {
        let contaId = p.contaBancariaId;
        if (!contaId) {
          const conta = await this.resolverContaInterCobranca(p.empresaId);
          contaId = conta.id;
          p.contaBancariaId = conta.id;
        }
        await this.emitirPixCobvTitulo(p.tituloReceberId, p.empresaId, contaId);
        p.resolvidaEm = new Date();
        resolvidos += 1;
      } catch (err) {
        p.ultimoErro = err instanceof Error ? err.message : 'ERRO_REEMISSAO';
      }
      await this.emissaoPendentes.save(p);
    }
    return { processados: pendentes.length, resolvidos };
  }

  async registrarFalhaEmissaoCobv(
    empresaId: string,
    tituloReceberId: string,
    contaBancariaId: string | null,
    erro: string,
  ) {
    await this.registrarEmissaoPendente({
      empresaId,
      tituloReceberId,
      contaBancariaId,
      modalidade: ModalidadeCobranca.PIX_COBV,
      erro,
    });
  }

  private async registrarEmissaoPendente(params: {
    empresaId: string;
    tituloReceberId: string;
    contaBancariaId: string | null;
    modalidade: ModalidadeCobranca;
    erro: string;
  }) {
    const existente = await this.emissaoPendentes.findOne({
      where: {
        tituloReceberId: params.tituloReceberId,
        modalidade: params.modalidade,
        resolvidaEm: IsNull(),
      },
    });
    if (existente) {
      existente.ultimoErro = params.erro;
      existente.tentativas += 1;
      if (params.contaBancariaId) existente.contaBancariaId = params.contaBancariaId;
      await this.emissaoPendentes.save(existente);
      return;
    }
    await this.emissaoPendentes.save(
      this.emissaoPendentes.create({
        empresaId: params.empresaId,
        tituloReceberId: params.tituloReceberId,
        contaBancariaId: params.contaBancariaId,
        modalidade: params.modalidade,
        ultimoErro: params.erro,
        tentativas: 1,
      }),
    );
  }

  private async resolverEmissaoPendente(tituloReceberId: string, modalidade: ModalidadeCobranca) {
    await this.emissaoPendentes.update(
      { tituloReceberId, modalidade, resolvidaEm: IsNull() },
      { resolvidaEm: new Date() },
    );
  }

  async resolverContaInterCobranca(empresaId: string, contaId?: string): Promise<ContaBancaria> {
    const id = contaId ?? this.config.get<string>('COB_CONTA_BANCARIA_ID');
    if (id) {
      return this.validarContaInter(id, empresaId, true);
    }
    const conta = await this.contas.findOne({
      where: { empresaId, provedor: ProvedorBancario.INTER, ativa: true },
      order: { apelido: 'ASC' },
    });
    if (!conta) {
      throw new BadRequestException(
        'Nenhuma conta Inter configurada para emissão Pix. Defina COB_CONTA_BANCARIA_ID ou cadastre uma conta Inter ativa.',
      );
    }
    return this.validarContaInter(conta.id, empresaId, true);
  }

  async registrarWebhookPixConta(
    contaId: string,
    empresaId: string,
    webhookUrl?: string,
  ): Promise<Record<string, unknown>> {
    const conta = await this.validarContaInter(contaId, empresaId, true);
    const url =
      webhookUrl?.trim() ||
      this.config.get<string>('PUBLIC_WEBHOOK_INTER_URL')?.trim();
    if (!url) {
      throw new BadRequestException('Informe webhook_url ou configure PUBLIC_WEBHOOK_INTER_URL');
    }
    return this.interPixCobv.cadastrarWebhookPix(conta.credencialRef!, conta.conta, conta.chavePix!, url);
  }

  async simularPagamentoMock(
    cobrancaId: string,
    empresaId: string,
    opcoes: { valorTotalRecebido: number; juros?: number; multa?: number; desconto?: number },
  ) {
    const cobranca = await this.cobrancas.findOne({ where: { id: cobrancaId, empresaId } });
    if (!cobranca?.idExterno) throw new NotFoundException('Cobrança não encontrada');
    if (cobranca.modalidade !== ModalidadeCobranca.COBRANCA_V3) {
      throw new BadRequestException('Simulação v3 apenas para modalidade COBRANCA_V3');
    }
    this.interCobranca.simularPagamentoMock(cobranca.idExterno, {
      valorTotalRecebido: opcoes.valorTotalRecebido,
      juros: opcoes.juros,
      multa: opcoes.multa,
      desconto: opcoes.desconto,
    });
    return { ok: true };
  }

  async simularPagamentoCobvMock(
    cobrancaId: string,
    empresaId: string,
    opcoes: { valor: number; juros?: number; multa?: number; desconto?: number },
  ) {
    const cobranca = await this.cobrancas.findOne({ where: { id: cobrancaId, empresaId } });
    const txid = cobranca?.txid ?? cobranca?.idExterno;
    if (!cobranca || cobranca.modalidade !== ModalidadeCobranca.PIX_COBV || !txid) {
      throw new NotFoundException('Cobv não encontrada');
    }
    this.interPixCobv.simularPagamentoCobvMock(txid, opcoes);
    return { ok: true, txid };
  }

  private validarDevedor(pessoa: Pessoa | null) {
    if (!pessoa?.nome?.trim()) {
      throw new BadRequestException(
        'Emissão recusada: informe o nome do devedor (pessoa vinculada ao título).',
      );
    }
    const doc = soDigitos(pessoa.documento);
    if (!doc || (doc.length !== 11 && doc.length !== 14)) {
      throw new BadRequestException(
        'Emissão recusada: informe CPF ou CNPJ válido do devedor na pessoa vinculada.',
      );
    }
  }

  private async validarContaInter(
    contaId: string,
    empresaId: string,
    exigeChavePix: boolean,
  ): Promise<ContaBancaria> {
    const conta = await this.contas.findOne({ where: { id: contaId, empresaId } });
    if (!conta || !conta.ativa) {
      throw new BadRequestException(
        'Emissão recusada: conta bancária Inter ativa não encontrada para esta empresa.',
      );
    }
    if (conta.provedor !== ProvedorBancario.INTER) {
      throw new BadRequestException('Emissão recusada: o provedor da conta deve ser INTER.');
    }
    if (!conta.credencialRef?.trim()) {
      throw new BadRequestException('Emissão recusada: configure credencial_ref na conta Inter.');
    }
    if (exigeChavePix && !conta.chavePix?.trim()) {
      throw new BadRequestException(
        'Emissão recusada: configure chave_pix na conta bancária Inter (chave cadastrada no Internet Banking).',
      );
    }
    return conta;
  }
}