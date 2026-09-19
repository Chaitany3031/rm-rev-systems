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

describe("Authentication and tenant membership authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Auth configuration boundary", () => {
    it("requires AUTH_SECRET in production", () => {
      const result = validateEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        AUTH_SECRET: "short",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.AUTH_SECRET).toBeDefined();
      }
    });

    it("accepts a strong AUTH_SECRET for valid configuration", () => {
      const result = validateEnv({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        AUTH_SECRET: "this-is-a-long-development-secret-123456",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.AUTH_SECRET).toBe("this-is-a-long-development-secret-123456");
      }
    });

    it("disables dev credentials by default", () => {
      const result = validateEnv({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        AUTH_SECRET: "this-is-a-long-development-secret-123456",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.AUTH_ENABLE_DEV_CREDENTIALS).toBe(false);
      }
    });

    it("allows dev credentials only when explicitly enabled", () => {
      const result = validateEnv({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        AUTH_SECRET: "this-is-a-long-development-secret-123456",
        AUTH_ENABLE_DEV_CREDENTIALS: "true",
        DEV_AUTH_EMAIL: "admin@example.com",
        DEV_AUTH_PASSWORD: "super-secret-password",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.AUTH_ENABLE_DEV_CREDENTIALS).toBe(true);
      }
    });

    it("rejects development credentials in production", () => {
      const result = validateEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        AUTH_SECRET: "this-is-a-long-production-secret-123456",
        AUTH_ENABLE_DEV_CREDENTIALS: "true",
        DEV_AUTH_EMAIL: "admin@example.com",
        DEV_AUTH_PASSWORD: "super-secret-password",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.AUTH_ENABLE_DEV_CREDENTIALS).toBeDefined();
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
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-unknown" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

    await expect(resolveCurrentUser()).rejects.toThrow(AuthenticationError);
  });

  it("uses the authenticated user ID as the membership lookup identity", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-a" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user-a",
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
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-a" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user-a",
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
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-a" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user-a",
      email: "user-a@example.com",
      name: "User A",
    } as never);
    vi.mocked(prisma.tenantMembership.findFirst).mockResolvedValueOnce(null);

    await expect(requireTenantAdmin("tenant-b")).rejects.toThrow(ForbiddenError);
  });

  it("requires ADMIN in the membership query and rejects non-admin members", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-a" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user-a",
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
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-a" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user-a",
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
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-a" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user-a",
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