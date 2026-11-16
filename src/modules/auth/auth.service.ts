import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UsuarioEmpresa } from '../../database/entities/usuario-empresa.entity';
import { Usuario } from '../../database/entities/usuario.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private usuarios: Repository<Usuario>,
    @InjectRepository(UsuarioEmpresa) private vinculos: Repository<UsuarioEmpresa>,
    private jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.senhaHash')
      .where('u.email = :email', { email: dto.email.toLowerCase() })
      .andWhere('u.ativo = true')
      .getOne();

    if (!usuario?.senhaHash) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const ok = await bcrypt.compare(dto.senha, usuario.senhaHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const empresas = await this.vinculos.find({
      where: { usuarioId: usuario.id },
      relations: ['empresa'],
    });

    const token = await this.jwt.signAsync({
      sub: usuario.id,
      email: usuario.email,
    });

    return {
      access_token: token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        empresas: empresas.map((e) => ({
          empresa_id: e.empresaId,
          papel: e.papel,
          razao_social: e.empresa?.razaoSocial,
        })),
      },
    };
  }
}