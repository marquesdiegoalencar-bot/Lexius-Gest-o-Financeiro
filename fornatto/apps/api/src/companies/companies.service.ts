import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, isActive: true },
      include: {
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }
    return company;
  }
}