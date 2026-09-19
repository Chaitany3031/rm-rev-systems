import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { AuthenticationError } from "@/lib/errors";
import type { AuthenticatedUser } from "./types";

/**
 * Resolve the authenticated application user from the real server-side session.
 *
 * The actual identity MUST come from the provider/session layer, never from the
 * browser or request context. We verify the persisted User record before handing
 * the identity to the authorization boundary.
 */
export async function resolveCurrentUser(): Promise<AuthenticatedUser> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new AuthenticationError("Authentication required");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new AuthenticationError("Authentication required");
  }

  return { userId: user.id };
}