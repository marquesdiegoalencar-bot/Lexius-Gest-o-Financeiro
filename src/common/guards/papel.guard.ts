import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PapelUsuario } from '../../database/enums';
import { UsuarioEmpresa } from '../../database/entities/usuario-empresa.entity';
import { PAPEIS_KEY } from '../decorators/papeis.decorator';

@Injectable()
export class PapelGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(UsuarioEmpresa)
    private usuarioEmpresaRepo: Repository<UsuarioEmpresa>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const papeis = this.reflector.getAllAndOverride<PapelUsuario[]>(PAPEIS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!papeis?.length) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{
      user?: { sub: string };
      headers: Record<string, string | string[] | undefined>;
    }>();
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException();
    }

    const empresaId = req.headers['x-empresa-id'];
    if (!empresaId || Array.isArray(empresaId)) {
      throw new ForbiddenException('Header X-Empresa-Id é obrigatório');
    }

    const vinculo = await this.usuarioEmpresaRepo.findOne({
      where: { usuarioId: userId, empresaId },
    });
    if (!vinculo || !papeis.includes(vinculo.papel)) {
      throw new ForbiddenException('Sem permissão para esta empresa');
    }

    (req as { empresaId?: string }).empresaId = empresaId;
    (req as { papel?: PapelUsuario }).papel = vinculo.papel;
    return true;
  }
}