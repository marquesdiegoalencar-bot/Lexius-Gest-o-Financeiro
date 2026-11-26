import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private hashRefresh(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseTtl(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 7 * 24 * 60 * 60;
    const value = Number(match[1]);
    const unit = match[2];
    const mult = { s: 1, m: 60, h: 3600, d: 86400 }[unit] ?? 86400;
    return value * mult;
  }

  async login(dto: LoginDto, meta?: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            company: true,
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });

    if (!user?.isActive) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTtl = process.env.JWT_REFRESH_TTL ?? '7d';
    const expiresAt = new Date(Date.now() + this.parseTtl(refreshTtl) * 1000);

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hashRefresh(refreshToken),
        expiresAt,
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
      },
    });

    await this.audit.log({
      action: 'auth.login',
      actorId: user.id,
      ipAddress: meta?.ip,
    });

    const companies = user.memberships.map((m) => ({
      id: m.company.id,
      name: m.company.name,
      slug: m.company.slug,
      role: m.role.slug,
    }));

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      sessionId: session.id,
    };

    return {
      user: { id: user.id, email: user.email, name: user.name },
      companies,
      requiresCompanySelection: companies.length > 1,
      accessToken: this.jwt.sign(payload),
      refreshToken,
    };
  }

  async selectCompany(userId: string, companyId: string, sessionId?: string) {
    const membership = await this.prisma.companyUser.findFirst({
      where: { userId, companyId, isActive: true },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
        user: true,
        company: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Sem acesso a esta empresa.');
    }

    const permissions = membership.role.permissions.map((rp) => rp.permission.code);

    const payload: JwtPayload = {
      sub: userId,
      email: membership.user.email,
      companyId: membership.companyId,
      roleSlug: membership.role.slug,
      permissions,
      sessionId,
    };

    if (sessionId) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { companyId },
      });
    }

    await this.audit.log({
      action: 'auth.select_company',
      actorId: userId,
      companyId,
    });

    return {
      accessToken: this.jwt.sign(payload),
      company: {
        id: membership.company.id,
        name: membership.company.name,
        slug: membership.company.slug,
      },
      role: membership.role.slug,
      permissions,
    };
  }
}