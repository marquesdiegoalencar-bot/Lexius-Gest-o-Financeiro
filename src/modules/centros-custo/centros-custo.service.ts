import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CentroCusto } from '../../database/entities/centro-custo.entity';
import { TipoCentroCusto, TipoNoCentroCusto } from '../../database/enums';
import { CreateCentroCustoDto } from './dto/create-centro-custo.dto';
import { UpdateCentroCustoDto } from './dto/update-centro-custo.dto';

const MAX_PROFUNDIDADE = 3;

@Injectable()
export class CentrosCustoService {
  constructor(
    @InjectRepository(CentroCusto) private repo: Repository<CentroCusto>,
    private dataSource: DataSource,
  ) {}

  list(empresaId: string, tipo?: TipoCentroCusto) {
    const where: { empresaId: string; tipo?: TipoCentroCusto } = { empresaId };
    if (tipo) where.tipo = tipo;
    return this.repo.find({
      where,
      order: { codigo: 'ASC', nome: 'ASC' },
    });
  }

  async listArvore(empresaId: string, tipo?: TipoCentroCusto) {
    const flat = await this.list(empresaId, tipo);
    type NoArvore = CentroCusto & { filhos: NoArvore[] };
    const byId = new Map<string, NoArvore>();
    for (const c of flat) {
      byId.set(c.id, { ...c, filhos: [] });
    }
    const raizes: NoArvore[] = [];
    for (const c of byId.values()) {
      if (c.paiId && byId.has(c.paiId)) {
        byId.get(c.paiId)!.filhos.push(c);
      } else {
        raizes.push(c);
      }
    }
    return raizes;
  }

  async findOne(id: string, empresaId: string) {
    const c = await this.repo.findOne({ where: { id, empresaId } });
    if (!c) throw new NotFoundException('Centro de custo não encontrado');
    return c;
  }

  async create(empresaId: string, dto: CreateCentroCustoDto) {
    const tipoNo = dto.tipo_no ?? TipoNoCentroCusto.ANALITICO;
    const paiId = dto.pai_id ?? null;
    const tipo = dto.tipo ?? TipoCentroCusto.ENTRADA;

    return this.dataSource.transaction(async (manager) => {
      await this.assertCodigoLivre(manager, empresaId, dto.codigo, undefined);
      await this.validateNovoNo(manager, empresaId, tipoNo, paiId, tipo);
      return manager.save(
        CentroCusto,
        manager.create(CentroCusto, {
          empresaId,
          codigo: dto.codigo?.trim() || null,
          nome: dto.nome.trim(),
          descricao: dto.descricao?.trim() || null,
          tipo,
          tipoNo,
          paiId,
        }),
      );
    });
  }

  async update(id: string, empresaId: string, dto: UpdateCentroCustoDto) {
    const needsLock =
      dto.ativo !== undefined || dto.pai_id !== undefined || dto.tipo_no !== undefined;

    if (needsLock) {
      return this.dataSource.transaction((manager) => this.applyUpdate(manager, id, empresaId, dto));
    }

    const c = await this.findOne(id, empresaId);
    if (dto.codigo !== undefined) {
      await this.assertCodigoLivre(this.repo.manager, empresaId, dto.codigo, id);
      c.codigo = dto.codigo?.trim() || null;
    }
    if (dto.nome !== undefined) c.nome = dto.nome.trim();
    if (dto.descricao !== undefined) c.descricao = dto.descricao?.trim() || null;
    if (dto.tipo !== undefined) c.tipo = dto.tipo;
    return this.repo.save(c);
  }

  private async applyUpdate(
    manager: EntityManager,
    id: string,
    empresaId: string,
    dto: UpdateCentroCustoDto,
  ) {
    const c = await manager.findOne(CentroCusto, {
      where: { id, empresaId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!c) throw new NotFoundException('Centro de custo não encontrado');

    if (dto.codigo !== undefined) {
      await this.assertCodigoLivre(manager, empresaId, dto.codigo, id);
      c.codigo = dto.codigo?.trim() || null;
    }
    if (dto.nome !== undefined) c.nome = dto.nome.trim();
    if (dto.descricao !== undefined) c.descricao = dto.descricao?.trim() || null;
    if (dto.tipo !== undefined) c.tipo = dto.tipo;

    const tipoNoFuturo = dto.tipo_no ?? c.tipoNo;
    const paiIdFuturo = dto.pai_id !== undefined ? dto.pai_id ?? null : c.paiId;

    if (dto.pai_id !== undefined || dto.tipo_no !== undefined) {
      if (paiIdFuturo) {
        await this.lockCentro(manager, paiIdFuturo, empresaId);
      }
      await this.validateNoExistente(manager, empresaId, id, tipoNoFuturo, paiIdFuturo, c.tipo);
    }

    if (dto.ativo === false && c.ativo) {
      await this.assertPodeInativar(manager, c);
      c.ativo = false;
    } else if (dto.ativo === true && !c.ativo) {
      await this.assertPodeReativar(manager, empresaId, c, tipoNoFuturo, paiIdFuturo);
      c.ativo = true;
    } else if (dto.ativo !== undefined) {
      c.ativo = dto.ativo;
    }

    if (dto.tipo_no !== undefined) c.tipoNo = tipoNoFuturo;
    if (dto.pai_id !== undefined) c.paiId = paiIdFuturo;

    return manager.save(CentroCusto, c);
  }

  /**
   * Deve ser chamado dentro da mesma transação que persiste o título (FOR UPDATE até o commit).
   */
  async assertVinculoFinanceiroTx(
    manager: EntityManager,
    empresaId: string,
    centroCustoId: string,
  ): Promise<void> {
    const c = await manager.findOne(CentroCusto, {
      where: { id: centroCustoId, empresaId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!c) {
      throw new NotFoundException('Centro de custo não encontrado');
    }
    if (c.tipoNo !== TipoNoCentroCusto.ANALITICO || !c.ativo) {
      throw new BadRequestException(
        'Somente centros de custo analíticos ativos podem receber novos vínculos financeiros',
      );
    }
  }

  private async lockCentro(manager: EntityManager, id: string, empresaId: string): Promise<CentroCusto> {
    const c = await manager.findOne(CentroCusto, {
      where: { id, empresaId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!c) throw new NotFoundException('Centro de custo não encontrado');
    return c;
  }

  private async validateNovoNo(
    manager: EntityManager,
    empresaId: string,
    tipoNo: TipoNoCentroCusto,
    paiId: string | null,
    tipoEntradaSaida: TipoCentroCusto,
  ) {
    this.assertRaizPermitida(tipoNo, paiId);
    if (paiId) {
      const pai = await this.lockCentro(manager, paiId, empresaId);
      if (!pai.ativo) {
        throw new BadRequestException('O centro de custo pai deve estar ativo');
      }
      if (pai.tipo !== tipoEntradaSaida) {
        throw new BadRequestException('Centro de custo pai deve ter o mesmo tipo (entrada/saída)');
      }
      this.assertFilhoPermitido(pai.tipoNo, tipoNo);
      await this.assertNotCycle(manager, '00000000-0000-4000-8000-000000000000', paiId);
      const profundidadePai = await this.profundidadeNo(manager, paiId, empresaId);
      if (profundidadePai + 1 > MAX_PROFUNDIDADE) {
        throw new BadRequestException(`Profundidade máxima da hierarquia é ${MAX_PROFUNDIDADE} níveis`);
      }
    }
  }

  private async validateNoExistente(
    manager: EntityManager,
    empresaId: string,
    id: string,
    tipoNo: TipoNoCentroCusto,
    paiId: string | null,
    tipoEntradaSaida: TipoCentroCusto,
  ) {
    this.assertRaizPermitida(tipoNo, paiId);
    if (tipoNo === TipoNoCentroCusto.ANALITICO) {
      const temFilhos = await manager.exists(CentroCusto, { where: { paiId: id } });
      if (temFilhos) {
        throw new BadRequestException('Centro analítico não pode ter filhos na hierarquia');
      }
    }
    if (paiId) {
      if (paiId === id) {
        throw new BadRequestException('Centro de custo não pode ser pai de si mesmo');
      }
      const pai = await this.lockCentro(manager, paiId, empresaId);
      if (pai.tipo !== tipoEntradaSaida) {
        throw new BadRequestException('Centro de custo pai deve ter o mesmo tipo (entrada/saída)');
      }
      this.assertFilhoPermitido(pai.tipoNo, tipoNo);
      await this.assertNotCycle(manager, id, paiId);
      const profundidadePai = await this.profundidadeNo(manager, paiId, empresaId);
      const alturaSubarvore = await this.alturaSubarvore(manager, id);
      if (profundidadePai + alturaSubarvore > MAX_PROFUNDIDADE) {
        throw new BadRequestException(`Profundidade máxima da hierarquia é ${MAX_PROFUNDIDADE} níveis`);
      }
    }
  }

  private assertRaizPermitida(tipoNo: TipoNoCentroCusto, paiId: string | null) {
    if (tipoNo === TipoNoCentroCusto.SUBGRUPO && !paiId) {
      throw new BadRequestException('Subgrupo não pode ser raiz; informe um grupo pai');
    }
  }

  private assertFilhoPermitido(paiTipoNo: TipoNoCentroCusto, filhoTipoNo: TipoNoCentroCusto) {
    if (filhoTipoNo === TipoNoCentroCusto.GRUPO) {
      throw new BadRequestException('Grupo não pode ser filho na hierarquia');
    }
    if (paiTipoNo === TipoNoCentroCusto.ANALITICO) {
      throw new BadRequestException('Centro analítico não pode ter filhos');
    }
    if (paiTipoNo === TipoNoCentroCusto.SUBGRUPO && filhoTipoNo === TipoNoCentroCusto.SUBGRUPO) {
      throw new BadRequestException('Subgrupo não pode ter outro subgrupo como filho');
    }
    if (paiTipoNo === TipoNoCentroCusto.SUBGRUPO && filhoTipoNo !== TipoNoCentroCusto.ANALITICO) {
      throw new BadRequestException('Subgrupo só pode ter centro analítico como filho');
    }
  }

  private async assertNotCycle(manager: EntityManager, nodeId: string, newPaiId: string) {
    let current: string | null = newPaiId;
    while (current) {
      if (current === nodeId) {
        throw new BadRequestException('Hierarquia inválida: referência circular');
      }
      const row: Pick<CentroCusto, 'id' | 'paiId'> | null = await manager.findOne(CentroCusto, {
        where: { id: current },
        select: { id: true, paiId: true },
      });
      if (!row) break;
      current = row.paiId;
    }
  }

  private async profundidadeNo(manager: EntityManager, id: string, empresaId: string): Promise<number> {
    let depth = 1;
    let current = await manager.findOne(CentroCusto, { where: { id, empresaId } });
    if (!current) throw new NotFoundException('Centro de custo não encontrado');
    while (current.paiId) {
      depth += 1;
      current = await manager.findOne(CentroCusto, { where: { id: current.paiId, empresaId } });
      if (!current) throw new NotFoundException('Centro de custo não encontrado');
    }
    return depth;
  }

  private async alturaSubarvore(manager: EntityManager, id: string): Promise<number> {
    const filhos = await manager.find(CentroCusto, { where: { paiId: id }, select: { id: true } });
    if (filhos.length === 0) return 1;
    let maxChild = 0;
    for (const f of filhos) {
      const h = await this.alturaSubarvore(manager, f.id);
      if (h > maxChild) maxChild = h;
    }
    return 1 + maxChild;
  }

  private async assertPodeInativar(manager: EntityManager, c: CentroCusto) {
    if (c.tipoNo === TipoNoCentroCusto.ANALITICO) {
      return;
    }
    const ativos = await this.hasActiveDescendant(manager, c.id);
    if (ativos) {
      throw new BadRequestException(
        'Grupo ou subgrupo com descendentes ativos não pode ser inativado',
      );
    }
  }

  private async assertPodeReativar(
    manager: EntityManager,
    empresaId: string,
    c: CentroCusto,
    tipoNo: TipoNoCentroCusto,
    paiId: string | null,
  ) {
    if (paiId) {
      const pai = await this.lockCentro(manager, paiId, empresaId);
      if (!pai.ativo) {
        throw new BadRequestException('Reativação exige centro de custo pai ativo');
      }
    }
    await this.validateNoExistente(manager, empresaId, c.id, tipoNo, paiId, c.tipo);
  }

  private async hasActiveDescendant(manager: EntityManager, id: string): Promise<boolean> {
    const rows = await manager.query(
      `WITH RECURSIVE descendentes AS (
         SELECT id, ativo FROM centros_custo WHERE pai_id = $1
         UNION ALL
         SELECT c.id, c.ativo FROM centros_custo c
         INNER JOIN descendentes d ON c.pai_id = d.id
       )
       SELECT 1 FROM descendentes WHERE ativo = true LIMIT 1`,
      [id],
    );
    return rows.length > 0;
  }

  private async assertCodigoLivre(
    manager: EntityManager,
    empresaId: string,
    codigo: string | undefined,
    ignoreId?: string,
  ) {
    const code = codigo?.trim();
    if (!code) return;
    const dup = await manager.findOne(CentroCusto, { where: { empresaId, codigo: code } });
    if (dup && dup.id !== ignoreId) {
      throw new ConflictException(`Código de centro de custo já em uso: ${code}`);
    }
  }
}