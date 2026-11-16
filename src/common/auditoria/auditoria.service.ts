import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria } from '../../database/entities/auditoria.entity';

export type AuditoriaRegistro = {
  empresaId?: string | null;
  usuarioId?: string | null;
  entidade: string;
  entidadeId?: string | null;
  acao: string;
  antes?: Record<string, unknown> | null;
  depois?: Record<string, unknown> | null;
  ip?: string | null;
};

@Injectable()
export class AuditoriaService {
  constructor(@InjectRepository(Auditoria) private repo: Repository<Auditoria>) {}

  async registrar(dados: AuditoriaRegistro) {
    return this.repo.save(
      this.repo.create({
        empresaId: dados.empresaId ?? null,
        usuarioId: dados.usuarioId ?? null,
        entidade: dados.entidade,
        entidadeId: dados.entidadeId ?? null,
        acao: dados.acao,
        antes: dados.antes ?? null,
        depois: dados.depois ?? null,
        ip: dados.ip ?? null,
      }),
    );
  }
}