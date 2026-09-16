import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncGoogleReviews, getTenantReviews, getReviewById } from "@/domains/google/reviews/service";
import { MockGoogleBusinessProfileProvider } from "@/domains/google/business-profile/provider";
import { prisma } from "@/lib/db";
import * as googleIndex from "@/domains/google";

// Mock the database client
vi.mock("@/lib/db", () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    googleConnection: {
      findUnique: vi.fn(),
    },
    googleReview: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Mock decryptToken
vi.mock("@/domains/google", async (importOriginal) => {
  const actual = await importOriginal<typeof googleIndex>();
  return {
    ...actual,
    decryptToken: vi.fn((token: string) => token.replace("encrypted-", "")),
  };
});

describe("Feature 05 — Google Review Sync Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("syncGoogleReviews", () => {
    it("throws ValidationError when tenantId is missing", async () => {
      await expect(syncGoogleReviews({}, new MockGoogleBusinessProfileProvider())).rejects.toThrow(
        "Invalid sync reviews input"
      );
    });

    it("throws NotFoundError when tenant does not exist", async () => {
      (prisma.tenant.findUnique as vi.Mock).mockResolvedValue(null);

      await expect(
        syncGoogleReviews({ tenantId: "non-existent-tenant" }, new MockGoogleBusinessProfileProvider())
      ).rejects.toThrow('Tenant with id "non-existent-tenant" not found');
    });

    it("throws GoogleConnectionNotFoundError when no Google connection exists", async () => {
      (prisma.tenant.findUnique as vi.Mock).mockResolvedValue({ id: "tenant-123", name: "Test Tenant" });
      (prisma.googleConnection.findUnique as vi.Mock).mockResolvedValue(null);

      await expect(
        syncGoogleReviews({ tenantId: "tenant-123" }, new MockGoogleBusinessProfileProvider())
      ).rejects.toThrow('No Google connection found for tenant "tenant-123"');
    });

    it("throws ValidationError when connection status is not CONNECTED", async () => {
      (prisma.tenant.findUnique as vi.Mock).mockResolvedValue({ id: "tenant-123", name: "Test Tenant" });
      (prisma.googleConnection.findUnique as vi.Mock).mockResolvedValue({
        id: "conn-123",
        tenantId: "tenant-123",
        status: "DISCONNECTED",
      });

      await expect(
        syncGoogleReviews({ tenantId: "tenant-123" }, new MockGoogleBusinessProfileProvider())
      ).rejects.toThrow("Google connection is not in CONNECTED status");
    });

    it("throws ValidationError when no location is selected", async () => {
      (prisma.tenant.findUnique as vi.Mock).mockResolvedValue({ id: "tenant-123", name: "Test Tenant" });
      (prisma.googleConnection.findUnique as vi.Mock).mockResolvedValue({
        id: "conn-123",
        tenantId: "tenant-123",
        status: "CONNECTED",
        googleLocationName: null,
      });

      await expect(
        syncGoogleReviews({ tenantId: "tenant-123" }, new MockGoogleBusinessProfileProvider())
      ).rejects.toThrow("No Google Business Profile location selected");
    });

    it("throws ValidationError when no access token is available", async () => {
      (prisma.tenant.findUnique as vi.Mock).mockResolvedValue({ id: "tenant-123", name: "Test Tenant" });
      (prisma.googleConnection.findUnique as vi.Mock).mockResolvedValue({
        id: "conn-123",
        tenantId: "tenant-123",
        status: "CONNECTED",
        googleLocationName: "locations/123",
        encryptedAccessToken: null,
      });

      await expect(
        syncGoogleReviews({ tenantId: "tenant-123" }, new MockGoogleBusinessProfileProvider())
      ).rejects.toThrow("No access token available");
    });

    it("syncs reviews successfully and creates new records", async () => {
      const tenant = { id: "tenant-123", name: "Test Tenant" };
      const connection = {
        id: "conn-123",
        tenantId: "tenant-123",
        status: "CONNECTED",
        googleLocationName: "locations/123",
        encryptedAccessToken: "encrypted-mock-token",
      };

      (prisma.tenant.findUnique as vi.Mock).mockResolvedValue(tenant);
      (prisma.googleConnection.findUnique as vi.Mock).mockResolvedValue(connection);
      (prisma.googleReview.findUnique as vi.Mock).mockResolvedValue(null);
      (prisma.googleReview.create as vi.Mock).mockResolvedValue({ id: "review-1" });

      const result = await syncGoogleReviews({ tenantId: "tenant-123" }, new MockGoogleBusinessProfileProvider());

      expect(result.processed).toBe(2);
      expect(result.created).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.completed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("updates existing reviews when they already exist", async () => {
      const tenant = { id: "tenant-123", name: "Test Tenant" };
      const connection = {
        id: "conn-123",
        tenantId: "tenant-123",
        status: "CONNECTED",
        googleLocationName: "locations/123",
        encryptedAccessToken: "encrypted-mock-token",
      };

      (prisma.tenant.findUnique as vi.Mock).mockResolvedValue(tenant);
      (prisma.googleConnection.findUnique as vi.Mock).mockResolvedValue(connection);
      (prisma.googleReview.findUnique as vi.Mock).mockResolvedValue({ id: "existing-review" });
      (prisma.googleReview.update as vi.Mock).mockResolvedValue({ id: "existing-review" });

      const result = await syncGoogleReviews({ tenantId: "tenant-123" }, new MockGoogleBusinessProfileProvider());

      expect(result.processed).toBe(2);
      expect(result.created).toBe(0);
      expect(result.updated).toBe(2);
      expect(result.completed).toBe(true);
    });

    it("returns error when provider.listReviews fails", async () => {
      const tenant = { id: "tenant-123", name: "Test Tenant" };
      const connection = {
        id: "conn-123",
        tenantId: "tenant-123",
        status: "CONNECTED",
        googleLocationName: "locations/123",
        encryptedAccessToken: "encrypted-mock-token",
      };

      (prisma.tenant.findUnique as vi.Mock).mockResolvedValue(tenant);
      (prisma.googleConnection.findUnique as vi.Mock).mockResolvedValue(connection);

      const failingProvider = new MockGoogleBusinessProfileProvider({ scenario: "api_failure" });
      const result = await syncGoogleReviews({ tenantId: "tenant-123" }, failingProvider);

      expect(result.processed).toBe(0);
      expect(result.completed).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("getTenantReviews", () => {
    it("throws ValidationError when tenantId is missing", async () => {
      await expect(getTenantReviews({})).rejects.toThrow("Invalid get reviews input");
    });

    it("throws NotFoundError when tenant does not exist", async () => {
      (prisma.tenant.findUnique as vi.Mock).mockResolvedValue(null);

      await expect(getTenantReviews({ tenantId: "non-existent" })).rejects.toThrow(
        'Tenant with id "non-existent" not found'
      );
    });

    it("returns paginated reviews successfully", async () => {
      (prisma.tenant.findUnique as vi.Mock).mockResolvedValue({ id: "tenant-123", name: "Test Tenant" });
      (prisma.googleReview.findMany as vi.Mock).mockResolvedValue([
        { id: "review-1", tenantId: "tenant-123", starRating: 5 },
        { id: "review-2", tenantId: "tenant-123", starRating: 4 },
      ]);
      (prisma.googleReview.count as vi.Mock).mockResolvedValue(10);

      const result = await getTenantReviews({ tenantId: "tenant-123", limit: 2, offset: 0 });

      expect(result.reviews).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(0);
    });

    it("uses default pagination values", async () => {
      (prisma.tenant.findUnique as vi.Mock).mockResolvedValue({ id: "tenant-123", name: "Test Tenant" });
      (prisma.googleReview.findMany as vi.Mock).mockResolvedValue([]);
      (prisma.googleReview.count as vi.Mock).mockResolvedValue(0);

      const result = await getTenantReviews({ tenantId: "tenant-123" });

      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });
  });

  describe("getReviewById", () => {
    it("returns null when tenantId or reviewId is missing", async () => {
      expect(await getReviewById("", "review-123")).toBeNull();
      expect(await getReviewById("tenant-123", "")).toBeNull();
    });

    it("returns null when review does not exist", async () => {
      (prisma.googleReview.findUnique as vi.Mock).mockResolvedValue(null);

      expect(await getReviewById("tenant-123", "review-123")).toBeNull();
    });

    it("returns null when review belongs to different tenant", async () => {
      (prisma.googleReview.findUnique as vi.Mock).mockResolvedValue({
        id: "review-123",
        tenantId: "other-tenant",
      });

      expect(await getReviewById("tenant-123", "review-123")).toBeNull();
    });

    it("returns review when it exists and belongs to tenant", async () => {
      const review = { id: "review-123", tenantId: "tenant-123", starRating: 5 };
      (prisma.googleReview.findUnique as vi.Mock).mockResolvedValue(review);

      const result = await getReviewById("tenant-123", "review-123");

      expect(result).toEqual(review);
    });
  });
});
