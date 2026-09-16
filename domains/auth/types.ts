export type TenantRole = "OWNER" | "ADMIN" | "STAFF";

export interface TenantAdminContext {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: TenantRole;
  userId?: string;
}
