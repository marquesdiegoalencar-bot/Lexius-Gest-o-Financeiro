export declare const SYSTEM_ROLES: {
    readonly OWNER: "owner";
    readonly ADMIN: "admin";
    readonly MANAGER: "manager";
    readonly OPERATOR: "operator";
};
export type SystemRoleSlug = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];
