import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    action: string;
    actorId?: string;
    companyId?: string;
    ipAddress?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditLog.create({
      data: {
        action: params.action,
        actorId: params.actorId,
        companyId: params.companyId,
        ipAddress: params.ipAddress,
        metadata: params.metadata,
      },
    });
  }
}