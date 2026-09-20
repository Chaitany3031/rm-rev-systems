import { currentUser } from "@clerk/nextjs/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { AuthenticationError } from "@/lib/errors";
import type { AuthenticatedUser } from "./types";

/**
 * Resolve the authenticated application user from the server-side Clerk session,
 * then map it to the local Prisma User record using the stable Clerk user ID.
 */
export async function resolveCurrentUser(): Promise<AuthenticatedUser> {
  const session = await auth();
  const clerkUserId = session?.userId;

  if (!clerkUserId) {
    throw new AuthenticationError("Authentication required");
  }

  let user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, clerkUserId: true, email: true },
  });

  if (!user) {
    const clerkUser = await currentUser();
    const primaryEmail = clerkUser?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();

    if (!clerkUser || !primaryEmail) {
      throw new AuthenticationError("Authentication required");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: primaryEmail },
      select: { id: true, clerkUserId: true, email: true },
    });

    if (existingUser) {
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: { clerkUserId },
        select: { id: true, clerkUserId: true, email: true },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: primaryEmail,
          name: clerkUser.fullName || primaryEmail,
          clerkUserId,
        },
        select: { id: true, clerkUserId: true, email: true },
      });
    }
  }

  if (!user) {
    throw new AuthenticationError("Authentication required");
  }

  return { userId: user.id };
}