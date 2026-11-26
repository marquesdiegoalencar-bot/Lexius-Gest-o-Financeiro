export declare const PERMISSIONS: {
    readonly COMPANY_READ: "company:read";
    readonly COMPANY_UPDATE: "company:update";
    readonly BRANCH_MANAGE: "branch:manage";
    readonly USER_MANAGE: "user:manage";
    readonly DASHBOARD_VIEW: "dashboard:view";
    readonly AUDIT_READ: "audit:read";
};
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export declare const ALL_PERMISSIONS: PermissionCode[];
