import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listByCompany(companyId: string) {
    return this.prisma.branch.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(
    companyId: string,
    data: { name: string; slug: string },
    actorId?: string,
  ) {
    const branch = await this.prisma.branch.create({
      data: { companyId, name: data.name, slug: data.slug },
    });
    await this.audit.log({
      action: 'branch.create',
      companyId,
      actorId,
      metadata: { branchId: branch.id, slug: branch.slug },
    });
    return branch;
  }
}