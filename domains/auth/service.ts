import { prisma } from "@/lib/db";
import { NotFoundError, AuthorizationError } from "@/lib/errors";
import type { TenantAdminContext } from "./types";

/**
 * Resolves and validates an administrative tenant context.
 *
 * Enforces:
 * - Tenant exists in the system.
 * - Public feedback tokens are rejected as admin authorization tokens.
 * - Resolves the tenant context required for administrative operations such as Google integration.
 */
export async function requireTenantAdmin(
  tenantIdOrSlug: string
): Promise<TenantAdminContext> {
  if (!tenantIdOrSlug || typeof tenantIdOrSlug !== "string" || tenantIdOrSlug.trim() === "") {
    throw new AuthorizationError("Tenant identifier is required for administrative operations");
  }

  const trimmed = tenantIdOrSlug.trim();

  // Guard: explicitly reject if someone passes an opaque publicToken as an admin identifier
  const publicTokenMatch = await prisma.tenant.findUnique({
    where: { publicToken: trimmed },
    select: { id: true, publicToken: true },
  });

  if (publicTokenMatch && trimmed === publicTokenMatch.publicToken) {
    // If the input was exclusively matching a publicToken and not an actual tenant ID or slug
    const directIdOrSlugMatch = await prisma.tenant.findFirst({
      where: {
        OR: [{ id: trimmed }, { slug: trimmed }],
      },
    });

    if (!directIdOrSlugMatch) {
      throw new AuthorizationError(
        "Public feedback tokens cannot be used to perform administrative operations"
      );
    }
  }

  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [{ id: trimmed }, { slug: trimmed }],
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  if (!tenant) {
    throw new NotFoundError(`Tenant "${trimmed}" not found`);
  }

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    role: "ADMIN",
  };
}
