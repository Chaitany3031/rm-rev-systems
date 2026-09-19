export type TenantRole = "OWNER" | "ADMIN" | "STAFF";

export interface AuthenticatedUser {
  userId: string;
}

export interface TenantAdminContext {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: TenantRole;
  userId: string;
}
