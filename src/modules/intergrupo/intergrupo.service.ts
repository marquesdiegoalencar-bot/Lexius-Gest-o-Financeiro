import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { toMoneyString } from '../../common/utils/money';
import { Empresa } from '../../database/entities/empresa.entity';
import { OperacaoIntergrupo } from '../../database/entities/operacao-intergrupo.entity';
import { TituloPagar } from '../../database/entities/titulo-pagar.entity';
import { TituloReceber } from '../../database/entities/titulo-receber.entity';
import { OrigemTitulo } from '../../database/enums';
import { CreateIntergrupoDto } from './dto/create-intergrupo.dto';

@Injectable()
export class IntergrupoService {
  constructor(
    private dataSource: DataSource,
    private auditoria: AuditoriaService,
    @InjectRepository(OperacaoIntergrupo) private repo: Repository<OperacaoIntergrupo>,
    @InjectRepository(Empresa) private empresas: Repository<Empresa>,
  ) {}

  list() {
    return this.repo.find({ order: { criadaEm: 'DESC' }, take: 100 });
  }

  async create(usuarioId: string, dto: CreateIntergrupoDto) {
    if (dto.empresa_credora_id === dto.empresa_devedora_id) {
      throw new BadRequestException('Empresas credora e devedora devem ser distintas');
    }
    const credora = await this.empresas.findOne({ where: { id: dto.empresa_credora_id, ativa: true } });
    const devedora = await this.empresas.findOne({ where: { id: dto.empresa_devedora_id, ativa: true } });
    if (!credora || !devedora) throw new BadRequestException('Empresa não encontrada');

    return this.dataSource.transaction(async (manager) => {
      const tituloReceber = await manager.save(
        manager.create(TituloReceber, {
          empresaId: dto.empresa_credora_id,
          descricao: dto.descricao,
          categoriaId: dto.categoria_receita_id,
          origem: OrigemTitulo.INTERGRUPO,
          valorOriginal: toMoneyString(dto.valor),
          dataVencimento: dto.data_vencimento,
          criadoPor: usuarioId,
        }),
      );

      const tituloPagar = await manager.save(
        manager.create(TituloPagar, {
          empresaId: dto.empresa_devedora_id,
          descricao: dto.descricao,
          categoriaId: dto.categoria_despesa_id,
          origem: OrigemTitulo.INTERGRUPO,
          valorOriginal: toMoneyString(dto.valor),
          dataVencimento: dto.data_vencimento,
          criadoPor: usuarioId,
        }),
      );

      const operacao = await manager.save(
        manager.create(OperacaoIntergrupo, {
          descricao: dto.descricao,
          empresaCredoraId: dto.empresa_credora_id,
          empresaDevedoraId: dto.empresa_devedora_id,
          tituloReceberId: tituloReceber.id,
          tituloPagarId: tituloPagar.id,
          valor: toMoneyString(dto.valor),
          dataVencimento: dto.data_vencimento,
          criadaPor: usuarioId,
        }),
      );

      await this.auditoria.registrar({
        empresaId: dto.empresa_credora_id,
        usuarioId,
        entidade: 'operacao_intergrupo',
        entidadeId: operacao.id,
        acao: 'CRIAR',
        depois: {
          titulo_receber_id: tituloReceber.id,
          titulo_pagar_id: tituloPagar.id,
        },
      });

      return { operacao, titulo_receber: tituloReceber, titulo_pagar: tituloPagar };
    });
  }
}