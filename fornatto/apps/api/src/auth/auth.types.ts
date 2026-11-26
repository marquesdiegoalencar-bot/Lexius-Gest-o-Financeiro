export type JwtPayload = {
  sub: string;
  email: string;
  companyId?: string;
  roleSlug?: string;
  permissions?: string[];
  sessionId?: string;
};