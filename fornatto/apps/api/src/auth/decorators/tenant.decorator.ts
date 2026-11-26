import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type TenantRef = { companyId: string };

export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantRef => {
    const request = ctx.switchToHttp().getRequest<{ tenant: TenantRef }>();
    return request.tenant;
  },
);