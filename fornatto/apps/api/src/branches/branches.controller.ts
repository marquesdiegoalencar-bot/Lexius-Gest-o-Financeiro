import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@fornatto/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Tenant } from '../auth/decorators/tenant.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.types';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';

@Controller('branches')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  list(@Tenant() tenant: { companyId: string }) {
    return this.branches.listByCompany(tenant.companyId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.BRANCH_MANAGE)
  create(
    @Tenant() tenant: { companyId: string },
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBranchDto,
  ) {
    return this.branches.create(tenant.companyId, dto, user.sub);
  }
}