import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtPayload } from '../auth.types';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: JwtPayload;
      tenant?: { companyId: string };
    }>();
    const user = request.user;
    if (!user?.companyId) {
      throw new ForbiddenException('Empresa não selecionada no token.');
    }
    request.tenant = { companyId: user.companyId };
    return true;
  }
}