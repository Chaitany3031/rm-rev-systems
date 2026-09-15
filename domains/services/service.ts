import { prisma } from "@/lib/db";
import type { PublicServiceInfo } from "./types";

/**
 * Returns all active services belonging to the specified tenant.
 * Services are ordered by their configured display order.
 */
export async function getActiveServicesForTenant(
  tenantId: string
): Promise<PublicServiceInfo[]> {
  if (!tenantId || typeof tenantId !== "string") {
    return [];
  }

  const services = await prisma.service.findMany({
    where: {
      tenantId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      description: true,
      order: true,
    },
    orderBy: [
      { order: "asc" },
      { createdAt: "asc" },
    ],
  });

  return services;
}
