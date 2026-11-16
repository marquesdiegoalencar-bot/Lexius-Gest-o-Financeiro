import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toMoneyString } from '../../common/utils/money';
import { Recorrencia } from '../../database/entities/recorrencia.entity';
import { TituloPagar } from '../../database/entities/titulo-pagar.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { Natureza, OrigemTitulo } from '../../database/enums';
import { CreateRecorrenciaDto } from './dto/create-recorrencia.dto';

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function proximoVencimento(rec: Recorrencia, aPartirDe: Date): Date | null {
  if (rec.fim && aPartirDe > new Date(rec.fim)) return null;
  const freq = rec.frequencia.toUpperCase();
  if (freq === 'MENSAL') {
    return addMonths(aPartirDe, 1);
  }
  if (freq === 'SEMANAL') {
    const d = new Date(aPartirDe);
    d.setDate(d.getDate() + 7);
    return d;
  }
  if (freq === 'ANUAL') {
    const d = new Date(aPartirDe);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  throw new BadRequestException(`Frequência não suportada: ${rec.frequencia}`);
}

@Injectable()
export class RecorrenciasService {
  constructor(
    @InjectRepository(Recorrencia) private repo: Repository<Recorrencia>,
    @InjectRepository(TituloReceber) private titulosReceber: Repository<TituloReceber>,
    @InjectRepository(TituloPagar) private titulosPagar: Repository<TituloPagar>,
  ) {}

  list(empresaId: string) {
    return this.repo.find({ where: { empresaId }, order: { inicio: 'ASC' } });
  }

  async findOne(id: string, empresaId: string) {
    const r = await this.repo.findOne({ where: { id, empresaId } });
    if (!r) throw new NotFoundException('Recorrência não encontrada');
    return r;
  }

  create(empresaId: string, dto: CreateRecorrenciaDto) {
    return this.repo.save(
      this.repo.create({
        empresaId,
        natureza: dto.natureza,
        descricao: dto.descricao,
        pessoaId: dto.pessoa_id ?? null,
        categoriaId: dto.categoria_id,
        contaBancariaId: dto.conta_bancaria_id ?? null,
        valor: toMoneyString(dto.valor),
        frequencia: dto.frequencia,
        diaVencimento: dto.dia_vencimento ?? null,
        inicio: dto.inicio,
        fim: dto.fim ?? null,
        gerarAntecedenciaDias: dto.gerar_antecedencia_dias ?? 30,
        ativa: dto.ativa ?? true,
      }),
    );
  }

  async gerar(id: string, empresaId: string, usuarioId: string) {
    const rec = await this.findOne(id, empresaId);
    if (!rec.ativa) throw new BadRequestException('Recorrência inativa');

    const hoje = new Date();
    const antecedencia = new Date(hoje);
    antecedencia.setDate(antecedencia.getDate() + rec.gerarAntecedenciaDias);

    let base = new Date(rec.inicio);
    if (base < hoje) {
      while (base < hoje) {
        const next = proximoVencimento(rec, base);
        if (!next) return { titulos: [], mensagem: 'Recorrência encerrada' };
        base = next;
      }
    }

    const venc = rec.diaVencimento
      ? new Date(base.getFullYear(), base.getMonth(), rec.diaVencimento)
      : base;

    if (venc > antecedencia) {
      return { titulos: [], mensagem: 'Ainda fora da janela de antecedência' };
    }

    const dataVenc = venc.toISOString().slice(0, 10);
    const descricao = `${rec.descricao} (recorrência)`;

    if (rec.natureza === Natureza.RECEITA) {
      const existente = await this.titulosReceber
        .createQueryBuilder('t')
        .where('t.empresa_id = :empresaId', { empresaId })
        .andWhere('t.origem = :origem', { origem: OrigemTitulo.RECORRENCIA })
        .andWhere('t.data_vencimento = :dataVenc', { dataVenc })
        .andWhere('t.descricao = :descricao', { descricao })
        .getOne();
      if (existente) return { titulos: [existente], duplicado: true };

      const titulo = await this.titulosReceber.save(
        this.titulosReceber.create({
          empresaId,
          descricao,
          pessoaId: rec.pessoaId,
          categoriaId: rec.categoriaId,
          contaBancariaId: rec.contaBancariaId,
          origem: OrigemTitulo.RECORRENCIA,
          valorOriginal: rec.valor,
          dataVencimento: dataVenc,
          criadoPor: usuarioId,
        }),
      );
      return { titulos: [titulo] };
    }

    const existente = await this.titulosPagar
      .createQueryBuilder('t')
      .where('t.empresa_id = :empresaId', { empresaId })
      .andWhere('t.recorrencia_id = :recId', { recId: rec.id })
      .andWhere('t.data_vencimento = :dataVenc', { dataVenc })
      .getOne();
    if (existente) return { titulos: [existente], duplicado: true };

    const titulo = await this.titulosPagar.save(
      this.titulosPagar.create({
        empresaId,
        descricao,
        fornecedorId: rec.pessoaId,
        categoriaId: rec.categoriaId,
        contaBancariaId: rec.contaBancariaId,
        recorrenciaId: rec.id,
        origem: OrigemTitulo.RECORRENCIA,
        valorOriginal: rec.valor,
        dataVencimento: dataVenc,
        criadoPor: usuarioId,
      }),
    );
    return { titulos: [titulo] };
  }
}