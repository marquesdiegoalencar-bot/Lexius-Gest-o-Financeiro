import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { Tenant } from '../auth/decorators/tenant.decorator';
import { CompaniesService } from './companies.service';

@Controller('companies')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get('me')
  me(@Tenant() tenant: { companyId: string }) {
    return this.companies.getCurrent(tenant.companyId);
  }
}