import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Empresa } from '../../database/entities/empresa.entity';
import { UsuarioEmpresa } from '../../database/entities/usuario-empresa.entity';
import { PapelUsuario } from '../../database/enums';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';

const DEPENDENCY_EXISTS_SQL = `
  SELECT (
    EXISTS (SELECT 1 FROM titulos_receber WHERE empresa_id = $1)
    OR EXISTS (SELECT 1 FROM titulos_pagar WHERE empresa_id = $1)
    OR EXISTS (SELECT 1 FROM baixas WHERE empresa_id = $1)
    OR EXISTS (SELECT 1 FROM cobranca_acordos WHERE empresa_id = $1)
    OR EXISTS (SELECT 1 FROM recorrencias WHERE empresa_id = $1)
    OR EXISTS (SELECT 1 FROM contas_bancarias WHERE empresa_id = $1)
    OR EXISTS (SELECT 1 FROM centros_custo WHERE empresa_id = $1)
    OR EXISTS (SELECT 1 FROM departamentos WHERE empresa_id = $1)
    OR EXISTS (SELECT 1 FROM categorias WHERE empresa_id = $1)
    OR EXISTS (SELECT 1 FROM cobrancas_boleto WHERE empresa_id = $1)
    OR EXISTS (SELECT 1 FROM pagamentos_bancarios WHERE empresa_id = $1)
    OR EXISTS (SELECT 1 FROM repasses WHERE empresa_id = $1)
    OR EXISTS (SELECT 1 FROM operacoes_intergrupo WHERE empresa_credora_id = $1 OR empresa_devedora_id = $1)
  ) AS bloqueado
`;

@Injectable()
export class EmpresasService {
  constructor(
    @InjectRepository(Empresa) private repo: Repository<Empresa>,
    @InjectRepository(UsuarioEmpresa) private vinculos: Repository<UsuarioEmpresa>,
  ) {}

  findAll() {
    return this.repo.find({ order: { razaoSocial: 'ASC' } });
  }

  async findOne(id: string) {
    const empresa = await this.repo.findOne({ where: { id } });
    if (!empresa) throw new NotFoundException('Empresa não encontrada');
    return empresa;
  }

  async create(dto: CreateEmpresaDto, criadorUsuarioId?: string) {
    const empresa = this.repo.create({
      tipo: dto.tipo,
      razaoSocial: dto.razao_social,
      nomeFantasia: dto.nome_fantasia ?? null,
      cnpj: dto.cnpj,
      fusoNegocio: dto.fuso_negocio?.trim() || 'America/Manaus',
    });

    try {
      const salva = await this.repo.save(empresa);
      if (criadorUsuarioId) {
        const existe = await this.vinculos.findOne({
          where: { usuarioId: criadorUsuarioId, empresaId: salva.id },
        });
        if (!existe) {
          await this.vinculos.save(
            this.vinculos.create({
              usuarioId: criadorUsuarioId,
              empresaId: salva.id,
              papel: PapelUsuario.MASTER,
            }),
          );
        }
      }
      return salva;
    } catch (e) {
      if (e instanceof QueryFailedError && String(e.message).includes('empresas_cnpj_key')) {
        throw new ConflictException('CNPJ já cadastrado');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateEmpresaDto) {
    const empresa = await this.findOne(id);
    if (dto.razao_social !== undefined) empresa.razaoSocial = dto.razao_social;
    if (dto.nome_fantasia !== undefined) empresa.nomeFantasia = dto.nome_fantasia;
    if (dto.tipo !== undefined) empresa.tipo = dto.tipo;
    if (dto.fuso_negocio !== undefined) empresa.fusoNegocio = dto.fuso_negocio.trim() || 'America/Manaus';
    if (dto.ativa !== undefined) empresa.ativa = dto.ativa;
    if (dto.cnpj !== undefined) empresa.cnpj = dto.cnpj;

    try {
      return await this.repo.save(empresa);
    } catch (e) {
      if (e instanceof QueryFailedError && String(e.message).includes('empresas_cnpj_key')) {
        throw new ConflictException('CNPJ já cadastrado');
      }
      throw e;
    }
  }

  async remove(id: string) {
    await this.findOne(id);

    const [{ bloqueado }] = await this.repo.manager.query(DEPENDENCY_EXISTS_SQL, [id]);
    if (bloqueado) {
      throw new ConflictException(
        'Não é possível excluir: a empresa possui movimentações ou cadastros vinculados. Inative-a em vez de apagar.',
      );
    }

    await this.vinculos.delete({ empresaId: id });

    try {
      await this.repo.delete(id);
    } catch (e) {
      if (e instanceof QueryFailedError && String(e.message).includes('23503')) {
        throw new ConflictException(
          'Não é possível excluir: existem registros dependentes. Inative a empresa.',
        );
      }
      throw e;
    }

    return { ok: true };
  }
}