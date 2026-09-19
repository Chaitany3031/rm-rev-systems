import { prisma } from "@/lib/db";
import { AuthorizationError, ForbiddenError } from "@/lib/errors";
import { resolveCurrentUser } from "./session";
import type { TenantAdminContext } from "./types";

/**
 * Resolves and validates an administrative tenant context from server-side identity.
 *
 * Enforces:
 * - An authenticated user exists.
 * - The authenticated user has membership in the requested tenant.
 * - The membership has the ADMIN role.
 */
export async function requireTenantAdmin(
  tenantIdOrSlug: string
): Promise<TenantAdminContext> {
  if (!tenantIdOrSlug || typeof tenantIdOrSlug !== "string" || tenantIdOrSlug.trim() === "") {
    throw new AuthorizationError("Tenant identifier is required for administrative operations");
  }

  const currentUser = await resolveCurrentUser();
  const trimmed = tenantIdOrSlug.trim();

  const membership = await prisma.tenantMembership.findFirst({
    where: {
      userId: currentUser.userId,
      tenant: {
        OR: [{ id: trimmed }, { slug: trimmed }],
      },
      role: "ADMIN",
    },
    select: {
      role: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!membership) {
    throw new ForbiddenError("You are not an administrator of this tenant");
  }

  return {
    userId: currentUser.userId,
    tenantId: membership.tenant.id,
    tenantName: membership.tenant.name,
    tenantSlug: membership.tenant.slug,
    role: "ADMIN",
  };
}
