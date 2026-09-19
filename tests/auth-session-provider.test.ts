import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    tenantMembership: {
      findFirst: vi.fn(),
    },
  },
}));

describe("real authentication provider boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests before resolving membership", async () => {
    const { auth } = await import("@/auth");
    const { resolveCurrentUser } = await import("@/domains/auth/session");
    vi.mocked(auth).mockResolvedValueOnce(null);

    await expect(resolveCurrentUser()).rejects.toThrow("Authentication required");
  });

  it("resolves an authenticated user from the provider session", async () => {
    const { auth } = await import("@/auth");
    const { prisma } = await import("@/lib/db");
    const { resolveCurrentUser } = await import("@/domains/auth/session");

    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "user-123", email: "admin@example.com" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: "user-123", email: "admin@example.com" } as never);

    await expect(resolveCurrentUser()).resolves.toEqual({ userId: "user-123" });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-123" },
      select: { id: true, email: true },
    });
  });

  it("rejects provider sessions whose user record cannot be resolved", async () => {
    const { auth } = await import("@/auth");
    const { prisma } = await import("@/lib/db");
    const { resolveCurrentUser } = await import("@/domains/auth/session");

    vi.mocked(auth).mockResolvedValueOnce({ user: { id: "missing-user" } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

    await expect(resolveCurrentUser()).rejects.toThrow("Authentication required");
  });
});
