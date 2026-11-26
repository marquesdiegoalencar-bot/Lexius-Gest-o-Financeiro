export const SYSTEM_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  OPERATOR: 'operator',
} as const;

export type SystemRoleSlug = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];