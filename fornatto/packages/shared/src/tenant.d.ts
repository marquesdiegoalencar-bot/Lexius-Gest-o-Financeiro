export type TenantContext = {
    companyId: string;
    branchId?: string;
    userId: string;
    roleSlug: string;
    permissions: string[];
};
