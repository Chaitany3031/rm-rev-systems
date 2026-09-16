import { describe, it, expect, vi, beforeEach } from "vitest";
import { triggerReviewSync, fetchTenantReviews } from "@/app/admin/google/reviews-actions";
import { AuthorizationError } from "@/lib/errors";

// Mock the auth module
vi.mock("@/domains/auth", () => ({
  requireTenantAdmin: vi.fn(),
}));

// Mock the reviews service
vi.mock("@/domains/google/reviews", () => ({
  syncGoogleReviews: vi.fn(),
  getTenantReviews: vi.fn(),
}));

describe("Feature 05 — Reviews Server Actions Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("triggerReviewSync", () => {
    it("rejects when requireTenantAdmin throws (unauthenticated/invalid token)", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authorization failed")
      );

      const result = await triggerReviewSync("any-tenant-id");

      expect(result.success).toBe(false);
      expect(result.errors?.form).toBeDefined();
    });

    it("rejects when tenantId is a public feedback token", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(
        new AuthorizationError("Public feedback tokens cannot be used to perform administrative operations")
      );

      const result = await triggerReviewSync("rm-solution-dev");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Public feedback tokens");
    });

    it("uses the authenticated tenant ID from requireTenantAdmin, not the browser-supplied one", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      const { syncGoogleReviews } = await import("@/domains/google/reviews");

      // Simulate: browser sends "tenant-b" but authenticated user owns "tenant-a"
      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        tenantId: "tenant-a", // This is what requireTenantAdmin resolves
        tenantName: "Tenant A",
        tenantSlug: "tenant-a",
        role: "ADMIN",
      });

      (syncGoogleReviews as ReturnType<typeof vi.fn>).mockResolvedValue({
        processed: 1,
        created: 1,
        updated: 0,
        completed: true,
      });

      const result = await triggerReviewSync("tenant-b");

      expect(result.success).toBe(true);
      // Verify syncGoogleReviews was called with the AUTHORIZED tenant, not the supplied one
      expect(syncGoogleReviews).toHaveBeenCalledWith({ tenantId: "tenant-a" });
      expect(syncGoogleReviews).not.toHaveBeenCalledWith({ tenantId: "tenant-b" });
    });

    it("returns error when requireTenantAdmin rejects (non-existent tenant)", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Tenant \"non-existent\" not found")
      );

      const result = await triggerReviewSync("non-existent");

      expect(result.success).toBe(false);
      expect(result.errors?.form).toBeDefined();
    });
  });

  describe("fetchTenantReviews", () => {
    it("rejects when requireTenantAdmin throws (unauthenticated/invalid token)", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authorization failed")
      );

      const result = await fetchTenantReviews({ tenantId: "any-tenant-id" });

      expect(result.success).toBe(false);
      expect(result.errors?.form).toBeDefined();
    });

    it("rejects when tenantId is a public feedback token", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(
        new AuthorizationError("Public feedback tokens cannot be used to perform administrative operations")
      );

      const result = await fetchTenantReviews({ tenantId: "rm-solution-dev" });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Public feedback tokens");
    });

    it("uses the authenticated tenant ID from requireTenantAdmin, not the browser-supplied one", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      const { getTenantReviews } = await import("@/domains/google/reviews");

      // Simulate: browser sends "tenant-b" but authenticated user owns "tenant-a"
      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        tenantId: "tenant-a",
        tenantName: "Tenant A",
        tenantSlug: "tenant-a",
        role: "ADMIN",
      });

      (getTenantReviews as ReturnType<typeof vi.fn>).mockResolvedValue({
        reviews: [],
        total: 0,
        limit: 50,
        offset: 0,
      });

      const result = await fetchTenantReviews({ tenantId: "tenant-b" });

      expect(result.success).toBe(true);
      // Verify getTenantReviews was called with the AUTHORIZED tenant, not the supplied one
      expect(getTenantReviews).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "tenant-a" })
      );
      expect(getTenantReviews).not.toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "tenant-b" })
      );
    });

    it("returns error when requireTenantAdmin rejects (non-existent tenant)", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Tenant \"non-existent\" not found")
      );

      const result = await fetchTenantReviews({ tenantId: "non-existent" });

      expect(result.success).toBe(false);
      expect(result.errors?.form).toBeDefined();
    });

    it("only returns reviews for the authenticated tenant", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      const { getTenantReviews } = await import("@/domains/google/reviews");

      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        tenantId: "tenant-a",
        tenantName: "Tenant A",
        tenantSlug: "tenant-a",
        role: "ADMIN",
      });

      const mockReviews = [
        { id: "review-1", tenantId: "tenant-a", starRating: 5 },
      ];

      (getTenantReviews as ReturnType<typeof vi.fn>).mockResolvedValue({
        reviews: mockReviews,
        total: 1,
        limit: 50,
        offset: 0,
      });

      const result = await fetchTenantReviews({ tenantId: "tenant-a" });

      expect(result.success).toBe(true);
      expect(result.data?.reviews).toHaveLength(1);
      expect(result.data?.reviews[0].tenantId).toBe("tenant-a");
    });
  });

  describe("Cross-tenant isolation", () => {
    it("Tenant A cannot sync Tenant B reviews (server action prevents cross-tenant access)", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      const { syncGoogleReviews } = await import("@/domains/google/reviews");

      // Even if someone tries to pass tenant-b as tenantId,
      // requireTenantAdmin validates and returns the REAL authenticated tenant
      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        tenantId: "tenant-a", // Authenticated as tenant-a
        tenantName: "Tenant A",
        tenantSlug: "tenant-a",
        role: "ADMIN",
      });

      (syncGoogleReviews as ReturnType<typeof vi.fn>).mockResolvedValue({
        processed: 0,
        created: 0,
        updated: 0,
        completed: true,
      });

      // Try to sync as tenant-b
      const result = await triggerReviewSync("tenant-b");

      expect(result.success).toBe(true);
      // Should have used tenant-a (the authenticated identity), not tenant-b
      expect(syncGoogleReviews).toHaveBeenCalledWith({ tenantId: "tenant-a" });
    });

    it("Tenant A cannot read Tenant B reviews (server action prevents cross-tenant access)", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      const { getTenantReviews } = await import("@/domains/google/reviews");

      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        tenantId: "tenant-a", // Authenticated as tenant-a
        tenantName: "Tenant A",
        tenantSlug: "tenant-a",
        role: "ADMIN",
      });

      (getTenantReviews as ReturnType<typeof vi.fn>).mockResolvedValue({
        reviews: [],
        total: 0,
        limit: 50,
        offset: 0,
      });

      // Try to read tenant-b's reviews
      const result = await fetchTenantReviews({ tenantId: "tenant-b" });

      expect(result.success).toBe(true);
      // Should have queried tenant-a's reviews, not tenant-b's
      expect(getTenantReviews).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "tenant-a" })
      );
    });
  });
});
