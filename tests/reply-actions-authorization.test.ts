import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateReplyDraftAction,
  editReplyDraftAction,
  regenerateReplyDraftAction,
  fetchReplyDraftAction,
} from "@/app/admin/google/reviews/reply-actions";
import { AuthorizationError, NotFoundError } from "@/lib/errors";

// Mock the auth module
vi.mock("@/domains/auth", () => ({
  requireTenantAdmin: vi.fn(),
}));

// Mock the reviews domain
vi.mock("@/domains/reviews", () => ({
  generateReplyDraft: vi.fn(),
  updateReplyDraft: vi.fn(),
  regenerateReplyDraft: vi.fn(),
  getReplyDraft: vi.fn(),
}));

// Mock the AI domain
vi.mock("@/domains/ai", () => ({
  getAIProvider: vi.fn(() => ({
    generateReplyDraft: vi.fn(),
  })),
}));

describe("Feature 06 — Reply Actions Server Actions Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateReplyDraftAction", () => {
    it("rejects when requireTenantAdmin throws (unauthenticated/invalid token)", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authorization failed")
      );

      const result = await generateReplyDraftAction("any-tenant-id", "review-1");

      expect(result.success).toBe(false);
      expect(result.errors?.form).toBeDefined();
    });

    it("rejects when tenantId is a public feedback token", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(
        new AuthorizationError("Public feedback tokens cannot be used to perform administrative operations")
      );

      const result = await generateReplyDraftAction("rm-solution-dev", "review-1");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Public feedback tokens");
    });

    it("uses the authenticated tenant ID from requireTenantAdmin, not the browser-supplied one", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      const { generateReplyDraft } = await import("@/domains/reviews");

      // Simulate: browser sends "tenant-b" but authenticated user owns "tenant-a"
      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        tenantId: "tenant-a",
        tenantName: "Tenant A",
        tenantSlug: "tenant-a",
        role: "ADMIN",
      });

      (generateReplyDraft as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "draft-1",
        tenantId: "tenant-a",
        googleReviewId: "review-1",
        content: "Reply draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await generateReplyDraftAction("tenant-b", "review-1");

      expect(result.success).toBe(true);
      // Verify generateReplyDraft was called with the AUTHORIZED tenant, not the supplied one
      expect(generateReplyDraft).toHaveBeenCalledWith(
        "tenant-a",
        "review-1",
        expect.anything()
      );
      expect(generateReplyDraft).not.toHaveBeenCalledWith(
        "tenant-b",
        expect.anything(),
        expect.anything()
      );
    });

    it("returns error when review is not found for the authenticated tenant", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      const { generateReplyDraft } = await import("@/domains/reviews");

      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        tenantId: "tenant-a",
        tenantName: "Tenant A",
        tenantSlug: "tenant-a",
        role: "ADMIN",
      });

      (generateReplyDraft as ReturnType<typeof vi.fn>).mockRejectedValue(
        new NotFoundError("Google review not found")
      );

      const result = await generateReplyDraftAction("tenant-a", "non-existent-review");

      expect(result.success).toBe(false);
      expect(result.errors?.form?.[0]).toContain("not found");
    });

    it("does not invoke AI provider when review is missing", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      const { generateReplyDraft } = await import("@/domains/reviews");
      const { getAIProvider } = await import("@/domains/ai");

      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        tenantId: "tenant-a",
        tenantName: "Tenant A",
        tenantSlug: "tenant-a",
        role: "ADMIN",
      });

      (generateReplyDraft as ReturnType<typeof vi.fn>).mockRejectedValue(
        new NotFoundError("Google review not found")
      );

      await generateReplyDraftAction("tenant-a", "non-existent-review");

      // AI provider should be obtained but never invoked due to early NotFoundError
      expect(getAIProvider).toHaveBeenCalled();
      const mockProvider = (getAIProvider as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockProvider.generateReplyDraft).not.toHaveBeenCalled();
    });
  });

  describe("editReplyDraftAction", () => {
    it("rejects when requireTenantAdmin throws (unauthenticated/invalid token)", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authorization failed")
      );

      const result = await editReplyDraftAction("any-tenant-id", "draft-1", "Edited");

      expect(result.success).toBe(false);
      expect(result.errors?.form).toBeDefined();
    });

    it("rejects when tenantId is a public feedback token", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(
        new AuthorizationError("Public feedback tokens cannot be used to perform administrative operations")
      );

      const result = await editReplyDraftAction("rm-solution-dev", "draft-1", "Edited");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Public feedback tokens");
    });

    it("uses the authenticated tenant ID, not the browser-supplied one", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      const { updateReplyDraft } = await import("@/domains/reviews");

      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        tenantId: "tenant-a",
        tenantName: "Tenant A",
        tenantSlug: "tenant-a",
        role: "ADMIN",
      });

      (updateReplyDraft as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "draft-1",
        tenantId: "tenant-a",
        googleReviewId: "review-1",
        content: "Edited content",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await editReplyDraftAction("tenant-b", "draft-1", "Edited content");

      expect(result.success).toBe(true);
      // Should use tenant-a (authenticated), not tenant-b (browser-supplied)
      expect(updateReplyDraft).toHaveBeenCalledWith("tenant-a", "draft-1", "Edited content");
      expect(updateReplyDraft).not.toHaveBeenCalledWith(
        "tenant-b",
        expect.anything(),
        expect.anything()
      );
    });

    it("returns error when draft does not belong to the authenticated tenant", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      const { updateReplyDraft } = await import("@/domains/reviews");

      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        tenantId: "tenant-a",
        tenantName: "Tenant A",
        tenantSlug: "tenant-a",
        role: "ADMIN",
      });

      (updateReplyDraft as ReturnType<typeof vi.fn>).mockRejectedValue(
        new NotFoundError("Reply draft not found")
      );

      const result = await editReplyDraftAction("tenant-a", "draft-not-mine", "Edit");

      expect(result.success).toBe(false);
      expect(result.errors?.form?.[0]).toContain("not found");
    });
  });

  describe("regenerateReplyDraftAction", () => {
    it("rejects when requireTenantAdmin throws (unauthenticated/invalid token)", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authorization failed")
      );

      const result = await regenerateReplyDraftAction("any-tenant-id", "review-1");

      expect(result.success).toBe(false);
      expect(result.errors?.form).toBeDefined();
    });

    it("uses the authenticated tenant ID, not the browser-supplied one", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      const { regenerateReplyDraft } = await import("@/domains/reviews");

      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        tenantId: "tenant-a",
        tenantName: "Tenant A",
        tenantSlug: "tenant-a",
        role: "ADMIN",
      });

      (regenerateReplyDraft as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "draft-1",
        tenantId: "tenant-a",
        googleReviewId: "review-1",
        content: "Regenerated reply",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await regenerateReplyDraftAction("tenant-b", "review-1");

      expect(result.success).toBe(true);
      // Should use tenant-a, not tenant-b
      expect(regenerateReplyDraft).toHaveBeenCalledWith("tenant-a", "review-1", expect.anything());
      expect(regenerateReplyDraft).not.toHaveBeenCalledWith(
        "tenant-b",
        expect.anything(),
        expect.anything()
      );
    });

    it("does not invoke AI provider when review is missing", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      const { regenerateReplyDraft } = await import("@/domains/reviews");
      const { getAIProvider } = await import("@/domains/ai");

      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        tenantId: "tenant-a",
        tenantName: "Tenant A",
        tenantSlug: "tenant-a",
        role: "ADMIN",
      });

      (regenerateReplyDraft as ReturnType<typeof vi.fn>).mockRejectedValue(
        new NotFoundError("Google review not found")
      );

      await regenerateReplyDraftAction("tenant-a", "non-existent-review");

      expect(getAIProvider).toHaveBeenCalled();
      const mockProvider = (getAIProvider as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockProvider.generateReplyDraft).not.toHaveBeenCalled();
    });
  });

  describe("fetchReplyDraftAction", () => {
    it("rejects when requireTenantAdmin throws (unauthenticated/invalid token)", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authorization failed")
      );

      const result = await fetchReplyDraftAction("any-tenant-id", "review-1");

      expect(result.success).toBe(false);
      expect(result.errors?.form).toBeDefined();
    });

    it("uses the authenticated tenant ID, not the browser-supplied one", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      const { getReplyDraft } = await import("@/domains/reviews");

      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        tenantId: "tenant-a",
        tenantName: "Tenant A",
        tenantSlug: "tenant-a",
        role: "ADMIN",
      });

      (getReplyDraft as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "draft-1",
        tenantId: "tenant-a",
        googleReviewId: "review-1",
        content: "Existing draft",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await fetchReplyDraftAction("tenant-b", "review-1");

      expect(result.success).toBe(true);
      // Should query tenant-a's draft, not tenant-b's
      expect(getReplyDraft).toHaveBeenCalledWith("tenant-a", "review-1");
      expect(getReplyDraft).not.toHaveBeenCalledWith("tenant-b", expect.anything());
    });

    it("returns not found when draft does not exist for the authenticated tenant", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      const { getReplyDraft } = await import("@/domains/reviews");

      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        tenantId: "tenant-a",
        tenantName: "Tenant A",
        tenantSlug: "tenant-a",
        role: "ADMIN",
      });

      (getReplyDraft as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await fetchReplyDraftAction("tenant-a", "review-1");

      expect(result.success).toBe(false);
      expect(result.message).toContain("No reply draft found");
    });
  });

  describe("Cross-tenant isolation", () => {
    it("Tenant A cannot generate a draft for Tenant B review", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      const { generateReplyDraft } = await import("@/domains/reviews");

      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        tenantId: "tenant-a",
        tenantName: "Tenant A",
        tenantSlug: "tenant-a",
        role: "ADMIN",
      });

      (generateReplyDraft as ReturnType<typeof vi.fn>).mockRejectedValue(
        new NotFoundError("Google review not found")
      );

      const result = await generateReplyDraftAction("tenant-b", "review-tenant-b");

      expect(result.success).toBe(false);
      // Domain service should have been called with tenant-a (authenticated), not tenant-b
      expect(generateReplyDraft).toHaveBeenCalledWith("tenant-a", "review-tenant-b", expect.anything());
    });

    it("Tenant A cannot update Tenant B draft", async () => {
      const { requireTenantAdmin } = await import("@/domains/auth");
      const { updateReplyDraft } = await import("@/domains/reviews");

      (requireTenantAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
        tenantId: "tenant-a",
        tenantName: "Tenant A",
        tenantSlug: "tenant-a",
        role: "ADMIN",
      });

      (updateReplyDraft as ReturnType<typeof vi.fn>).mockRejectedValue(
        new NotFoundError("Reply draft not found")
      );

      const result = await editReplyDraftAction("tenant-b", "draft-tenant-b", "Edited");

      expect(result.success).toBe(false);
      expect(updateReplyDraft).toHaveBeenCalledWith("tenant-a", "draft-tenant-b", "Edited");
    });
  });
});
