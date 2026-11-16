import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UsuarioEmpresa } from '../../database/entities/usuario-empresa.entity';
import { Usuario } from '../../database/entities/usuario.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario) private usuarios: Repository<Usuario>,
    @InjectRepository(UsuarioEmpresa) private vinculos: Repository<UsuarioEmpresa>,
  ) {}

  async listByEmpresa(empresaId: string) {
    const vinculos = await this.vinculos.find({
      where: { empresaId },
      relations: ['usuario'],
    });
    return vinculos.map((v) => ({
      usuario_id: v.usuarioId,
      nome: v.usuario.nome,
      email: v.usuario.email,
      papel: v.papel,
      ativo: v.usuario.ativo,
      mfa_ativo: v.usuario.mfaAtivo,
    }));
  }

  async create(dto: CreateUsuarioDto) {
    const email = dto.email.toLowerCase();
    const existe = await this.usuarios.findOne({ where: { email } });
    if (existe) {
      throw new ConflictException('E-mail já cadastrado');
    }
    const senhaHash = await bcrypt.hash(dto.senha, 12);
    const usuario = await this.usuarios.save(
      this.usuarios.create({
        nome: dto.nome,
        email,
        senhaHash,
        cobrancaUserId: dto.cobranca_user_id ?? null,
      }),
    );
    await this.vinculos.save(
      this.vinculos.create({
        usuarioId: usuario.id,
        empresaId: dto.empresa_id,
        papel: dto.papel,
      }),
    );
    return { id: usuario.id, email: usuario.email, nome: usuario.nome, papel: dto.papel };
  }

  async update(usuarioId: string, empresaId: string, dto: UpdateUsuarioDto) {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const vinculo = await this.vinculos.findOne({ where: { usuarioId, empresaId } });
    if (!vinculo) throw new NotFoundException('Usuário não vinculado a esta empresa');

    if (dto.nome !== undefined) usuario.nome = dto.nome;
    if (dto.ativo !== undefined) usuario.ativo = dto.ativo;
    if (dto.mfa_ativo !== undefined) usuario.mfaAtivo = dto.mfa_ativo;
    if (dto.senha) {
      usuario.senhaHash = await bcrypt.hash(dto.senha, 12);
    }
    await this.usuarios.save(usuario);

    if (dto.papel !== undefined) {
      vinculo.papel = dto.papel;
      await this.vinculos.save(vinculo);
    }

    return { id: usuario.id, email: usuario.email, nome: usuario.nome, papel: vinculo.papel };
  }
}