import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { soDigitos, tipoPessoaPorDocumento } from '../../common/utils/documento';
import { FormaPagamento, OrigemTitulo, StatusTitulo, TipoEmpresa, TipoPessoa } from '../../database/enums';
import { CobrancaAcordo } from '../../database/entities/cobranca-acordo.entity';
import { Empresa } from '../../database/entities/empresa.entity';
import { Pessoa } from '../../database/entities/pessoa.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { CategoriasService } from '../categorias/categorias.service';
import { ReceberAcordoDto } from './dto/receber-acordo.dto';

@Injectable()
export class IntegracaoCobrancaService {
  constructor(
    private dataSource: DataSource,
    private config: ConfigService,
    private categorias: CategoriasService,
    @InjectRepository(Empresa) private empresas: Repository<Empresa>,
    @InjectRepository(CobrancaAcordo) private acordos: Repository<CobrancaAcordo>,
    @InjectRepository(Pessoa) private pessoas: Repository<Pessoa>,
    @InjectRepository(TituloReceber) private titulos: Repository<TituloReceber>,
  ) {}

  private async resolverEmpresaCobranca(): Promise<Empresa> {
    const cnpj = soDigitos(this.config.get<string>('COB_EMPRESA_CNPJ'));
    if (cnpj) {
      const porCnpj = await this.empresas.findOne({ where: { cnpj, ativa: true } });
      if (porCnpj) return porCnpj;
    }
    const [cobranca] = await this.empresas.find({
      where: { tipo: TipoEmpresa.COBRANCA, ativa: true },
      order: { criadaEm: 'ASC' },
      take: 1,
    });
    if (!cobranca) {
      throw new BadRequestException('Nenhuma empresa COBRANCA cadastrada');
    }
    return cobranca;
  }

  private validarTotais(dto: ReceberAcordoDto) {
    const esperado = Math.round((dto.valor_original - dto.desconto) * 100) / 100;
    if (Math.abs(esperado - dto.valor_acordado) > 0.009) {
      throw new BadRequestException('valor_acordado deve ser valor_original - desconto');
    }
    const somaParcelas =
      Math.round(dto.parcelas.reduce((s, p) => s + p.valor, 0) * 100) / 100;
    if (Math.abs(somaParcelas - dto.valor_acordado) > 0.009) {
      throw new BadRequestException('Soma das parcelas difere de valor_acordado');
    }
  }

  private async upsertPessoa(
    dados: { nome: string; documento?: string },
    flags: Partial<Pick<Pessoa, 'ehCredor'>>,
  ): Promise<Pessoa> {
    const documento = soDigitos(dados.documento);
    if (documento) {
      const existente = await this.pessoas.findOne({ where: { documento } });
      if (existente) {
        if (flags.ehCredor) existente.ehCredor = true;
        existente.nome = dados.nome;
        return this.pessoas.save(existente);
      }
    }
    const tipo =
      dados.documento && tipoPessoaPorDocumento(documento) === 'JURIDICA'
        ? TipoPessoa.JURIDICA
        : TipoPessoa.FISICA;
    return this.pessoas.save(
      this.pessoas.create({
        tipoPessoa: tipo,
        nome: dados.nome,
        documento,
        ehCliente: !flags.ehCredor,
        ehCredor: !!flags.ehCredor,
      }),
    );
  }

  async receberAcordo(dto: ReceberAcordoDto) {
    this.validarTotais(dto);
    const empresa = await this.resolverEmpresaCobranca();

    const existente = await this.acordos.findOne({
      where: { empresaId: empresa.id, codigo: dto.codigo },
    });
    if (existente) {
      const titulos = await this.titulos.find({
        where: { acordoId: existente.id },
        order: { parcelaNumero: 'ASC' },
      });
      return this.mapResposta(existente, titulos, true);
    }

    const categoria = await this.categorias.findRecebimentoCobrancaGlobal();
    const forma =
      dto.forma_pagamento === 'PIX' ? FormaPagamento.PIX : FormaPagamento.BOLETO;

    return this.dataSource.transaction(async (manager) => {
      const devedor = await this.upsertPessoa(dto.devedor, { ehCredor: false });
      const credor = await this.upsertPessoa(dto.credor, { ehCredor: true });

      const entrada = dto.parcelas.find((p) => p.tipo === 'ENTRADA');
      const qtdParcelas = dto.parcelas.filter((p) => p.tipo === 'PARCELA').length;
      const primeiroVenc =
        dto.parcelas.slice().sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0]
          ?.vencimento ?? null;

      const acordo = await manager.save(
        manager.create(CobrancaAcordo, {
          empresaId: empresa.id,
          codigo: dto.codigo,
          devedorId: devedor.id,
          credorId: credor.id,
          tipo: dto.tipo,
          formaPagamento: forma,
          valorOriginal: String(dto.valor_original),
          valorAcordado: String(dto.valor_acordado),
          desconto: String(dto.desconto),
          valorEntrada: entrada ? String(entrada.valor) : '0',
          qtdParcelas,
          dataAcordo: dto.data_acordo,
          primeiroVencimento: primeiroVenc,
        }),
      );

      const parcelaTotal = dto.parcelas.length;
      const titulosCriados: TituloReceber[] = [];

      for (const parcela of dto.parcelas) {
        const descricao = `Acordo ${dto.codigo} — ${
          parcela.tipo === 'ENTRADA' ? 'Entrada' : `Parcela ${parcela.numero}`
        }`;
        const titulo = await manager.save(
          manager.create(TituloReceber, {
            empresaId: empresa.id,
            descricao,
            pessoaId: devedor.id,
            credorId: credor.id,
            categoriaId: categoria.id,
            origem: OrigemTitulo.COBRANCA_ACORDO,
            acordoId: acordo.id,
            cobrancaAcordoId: dto.codigo,
            cobrancaParcelaId: parcela.id_parcela,
            tipoParcela: parcela.tipo,
            parcelaNumero: parcela.numero,
            parcelaTotal,
            valorOriginal: String(parcela.valor),
            dataVencimento: parcela.vencimento,
            formaPrevista: forma,
            status: StatusTitulo.ABERTO,
          }),
        );
        titulosCriados.push(titulo);
      }

      return this.mapResposta(acordo, titulosCriados, false);
    });
  }

  private mapResposta(acordo: CobrancaAcordo, titulos: TituloReceber[], idempotente: boolean) {
    return {
      idempotente,
      acordo: {
        id: acordo.id,
        codigo: acordo.codigo,
        empresa_id: acordo.empresaId,
        status_acordo: acordo.statusAcordo,
        status_pagamento: acordo.statusPagamento,
      },
      titulos: titulos.map((t) => ({
        id: t.id,
        cobranca_parcela_id: t.cobrancaParcelaId,
        parcela_numero: t.parcelaNumero,
        tipo_parcela: t.tipoParcela,
        valor_original: Number(t.valorOriginal),
        data_vencimento: t.dataVencimento,
        status: t.status,
        valor_recebido: Number(t.valorRecebido),
        saldo: Number(t.valorOriginal) - Number(t.valorRecebido),
      })),
    };
  }
}