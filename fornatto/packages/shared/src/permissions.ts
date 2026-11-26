export const PERMISSIONS = {
  COMPANY_READ: 'company:read',
  COMPANY_UPDATE: 'company:update',
  BRANCH_MANAGE: 'branch:manage',
  USER_MANAGE: 'user:manage',
  DASHBOARD_VIEW: 'dashboard:view',
  AUDIT_READ: 'audit:read',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS);