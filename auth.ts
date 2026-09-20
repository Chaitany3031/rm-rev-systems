import { auth as clerkAuth } from "@clerk/nextjs/server";

/**
 * Application-level auth boundary.
 *
 * This keeps the rest of the app agnostic to the provider and preserves the
 * tenant membership + ADMIN checks as the authoritative authorization layer.
 */
export async function auth() {
  return clerkAuth();
}

export default auth;
