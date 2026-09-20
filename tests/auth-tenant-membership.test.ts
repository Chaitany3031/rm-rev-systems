import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { requireTenantAdmin } from "@/domains/auth";
import { resolveCurrentUser } from "@/domains/auth/session";
import { prisma } from "@/lib/db";
import { AuthenticationError, ForbiddenError } from "@/lib/errors";
import { validateEnv } from "@/lib/env";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    tenantMembership: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn(),
}));

describe("Authentication and tenant membership authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Auth configuration boundary", () => {
    it("requires Clerk keys in production", () => {
      const result = validateEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
        CLERK_SECRET_KEY: "",
        TOKEN_ENCRYPTION_SECRET: "test-token-encryption-secret",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toBeDefined();
        expect(result.error.flatten().fieldErrors.CLERK_SECRET_KEY).toBeDefined();
      }
    });

    it("accepts Clerk configuration for valid local development", () => {
      const result = validateEnv({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_abc123",
        CLERK_SECRET_KEY: "sk_test_abc123",
        TOKEN_ENCRYPTION_SECRET: "test-token-encryption-secret",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toBe("pk_test_abc123");
        expect(result.data.CLERK_SECRET_KEY).toBe("sk_test_abc123");
      }
    });
  });

  const adminMembership = {
    role: "ADMIN",
    tenant: {
      id: "tenant-a",
      name: "Tenant A",
      slug: "tenant-a",
    },
  };

  it("rejects unauthenticated requests before querying membership", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);

    await expect(requireTenantAdmin("tenant-a")).rejects.toThrow(AuthenticationError);
    expect(prisma.tenantMembership.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an unknown persisted user after a valid session", async () => {
    const { currentUser } = await import("@clerk/nextjs/server");

    vi.mocked(auth).mockResolvedValueOnce({ userId: "clerk_user_unknown" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(currentUser).mockResolvedValueOnce(null as never);

    await expect(resolveCurrentUser()).rejects.toThrow(AuthenticationError);
  });

  it("uses the authenticated Clerk user mapping as the membership lookup identity", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: "clerk_user_a" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user-a",
      clerkUserId: "clerk_user_a",
      email: "user-a@example.com",
      name: "User A",
    } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValueOnce(adminMembership as never);

    const result = await requireTenantAdmin("tenant-a");

    expect(prisma.tenantMembership.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-a",
        tenant: { OR: [{ id: "tenant-a" }, { slug: "tenant-a" }] },
        role: "ADMIN",
      },
      select: {
        role: true,
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });
    expect(result.userId).toBe("user-a");
  });

  it("accepts a valid ADMIN membership and returns trusted identity", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: "clerk_user_a" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user-a",
      clerkUserId: "clerk_user_a",
      email: "user-a@example.com",
      name: "User A",
    } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValueOnce(adminMembership as never);

    await expect(requireTenantAdmin("tenant-a")).resolves.toEqual({
      userId: "user-a",
      tenantId: "tenant-a",
      tenantName: "Tenant A",
      tenantSlug: "tenant-a",
      role: "ADMIN",
    });
  });

  it("rejects a missing membership", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: "clerk_user_a" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user-a",
      clerkUserId: "clerk_user_a",
      email: "user-a@example.com",
      name: "User A",
    } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValueOnce(null);

    await expect(requireTenantAdmin("tenant-b")).rejects.toThrow(ForbiddenError);
  });

  it("requires ADMIN in the membership query and rejects non-admin members", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: "clerk_user_a" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user-a",
      clerkUserId: "clerk_user_a",
      email: "user-a@example.com",
      name: "User A",
    } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValueOnce(null);

    await expect(requireTenantAdmin("tenant-a")).rejects.toThrow(ForbiddenError);
    expect(prisma.tenantMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: "ADMIN" }),
      })
    );
  });

  it("rejects cross-tenant access when the authenticated user has no membership", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: "clerk_user_a" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user-a",
      clerkUserId: "clerk_user_a",
      email: "user-a@example.com",
      name: "User A",
    } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValueOnce(null);

    await expect(requireTenantAdmin("tenant-b")).rejects.toThrow(ForbiddenError);
    expect(prisma.tenantMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-a",
          tenant: { OR: [{ id: "tenant-b" }, { slug: "tenant-b" }] },
        }),
      })
    );
  });

  it("does not let a requested tenant override the validated membership tenant", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: "clerk_user_a" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user-a",
      clerkUserId: "clerk_user_a",
      email: "user-a@example.com",
      name: "User A",
    } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValueOnce(adminMembership as never);

    const result = await requireTenantAdmin("tenant-a");

    expect(result.tenantId).toBe("tenant-a");
    expect(result.role).toBe("ADMIN");
    expect(result.userId).toBe("user-a");
  });
});