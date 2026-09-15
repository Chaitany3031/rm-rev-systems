import { prisma } from "@/lib/db";
import type { PublicTenantInfo } from "./types";

/**
 * Resolves a tenant by their opaque public token.
 * Returns safe public tenant information or null if not found.
 */
export async function getTenantByPublicToken(
  publicToken: string
): Promise<PublicTenantInfo | null> {
  if (!publicToken || typeof publicToken !== "string" || publicToken.trim() === "") {
    return null;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { publicToken: publicToken.trim() },
    select: {
      id: true,
      name: true,
      slug: true,
      publicToken: true,
      description: true,
    },
  });

  return tenant;
}
