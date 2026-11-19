import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { SenhaResetToken } from '../../database/entities/senha-reset-token.entity';
import { UsuarioEmpresa } from '../../database/entities/usuario-empresa.entity';
import { Usuario } from '../../database/entities/usuario.entity';
import { EsqueciSenhaDto } from './dto/esqueci-senha.dto';
import { LoginDto } from './dto/login.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private usuarios: Repository<Usuario>,
    @InjectRepository(UsuarioEmpresa) private vinculos: Repository<UsuarioEmpresa>,
    @InjectRepository(SenhaResetToken) private resetTokens: Repository<SenhaResetToken>,
    private jwt: JwtService,
    private config: ConfigService,
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

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async esqueciSenha(dto: EsqueciSenhaDto) {
    const email = dto.email.trim().toLowerCase();
    const usuario = await this.usuarios.findOne({ where: { email, ativo: true } });

    const resposta: {
      message: string;
      reset_token?: string;
      reset_path?: string;
    } = {
      message:
        'Se o e-mail estiver cadastrado, você receberá instruções para redefinir a senha em instantes.',
    };

    if (!usuario) {
      return resposta;
    }

    const tokenClaro = randomBytes(32).toString('base64url');
    await this.resetTokens.update(
      { usuarioId: usuario.id, usadoEm: IsNull() },
      { usadoEm: new Date() },
    );

    const expiraEm = new Date(Date.now() + 60 * 60 * 1000);
    await this.resetTokens.save(
      this.resetTokens.create({
        usuarioId: usuario.id,
        tokenHash: this.hashResetToken(tokenClaro),
        expiraEm,
      }),
    );

    const expose =
      this.config.get<string>('NODE_ENV') !== 'production' ||
      this.config.get<string>('PASSWORD_RESET_EXPOSE_TOKEN') === 'true';
    if (expose) {
      resposta.reset_token = tokenClaro;
      resposta.reset_path = `/login/redefinir-senha?token=${encodeURIComponent(tokenClaro)}`;
    }

    return resposta;
  }

  async redefinirSenha(dto: RedefinirSenhaDto) {
    const hash = this.hashResetToken(dto.token.trim());
    const registro = await this.resetTokens.findOne({
      where: {
        tokenHash: hash,
        usadoEm: IsNull(),
        expiraEm: MoreThan(new Date()),
      },
    });
    if (!registro) {
      throw new BadRequestException('Token inválido ou expirado. Solicite uma nova redefinição.');
    }

    const usuario = await this.usuarios.findOne({ where: { id: registro.usuarioId, ativo: true } });
    if (!usuario) {
      throw new BadRequestException('Usuário não encontrado.');
    }

    usuario.senhaHash = await bcrypt.hash(dto.nova_senha, 12);
    await this.usuarios.save(usuario);
    registro.usadoEm = new Date();
    await this.resetTokens.save(registro);

    return { message: 'Senha redefinida com sucesso. Faça login com a nova senha.' };
  }
}