import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveReplyDraft,
  approveReplyDraftRequestSchema,
  updateReplyDraft,
  regenerateReplyDraft,
} from "@/domains/reviews";
import { AuthorizationError, ValidationError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    googleReview: {
      findFirst: vi.fn(),
    },
    reviewReplyDraft: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/domains/auth", () => ({
  requireTenantAdmin: vi.fn(),
}));

vi.mock("@/domains/ai", () => ({
  getAIProvider: vi.fn(),
}));

describe("Feature 07 - approval workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const draft = {
    id: "draft-a",
    tenantId: "tenant-a",
    googleReviewId: "review-a",
    content: "Thank you for your feedback.",
    provider: "mock",
    model: null,
    createdAt: new Date("2026-09-16T10:00:00Z"),
    updatedAt: new Date("2026-09-16T10:00:00Z"),
    approved: false,
    approvedAt: null,
    approvedById: null,
  };

  it("approves only the authenticated tenant's draft and persists approval metadata", async () => {
    vi.mocked(prisma.reviewReplyDraft.findFirst)
      .mockResolvedValueOnce(draft as never)
      .mockResolvedValueOnce({
        ...draft,
        approved: true,
        approvedAt: new Date("2026-09-16T11:00:00Z"),
        approvedById: "user-a",
      } as never);
    vi.mocked(prisma.reviewReplyDraft.updateMany).mockResolvedValueOnce({ count: 1 });

    const result = await approveReplyDraft("tenant-a", "draft-a", "user-a");

    expect(result.approved).toBe(true);
    expect(result.content).toBe(draft.content);
    expect(prisma.reviewReplyDraft.updateMany).toHaveBeenCalledWith({
      where: { id: "draft-a", tenantId: "tenant-a", approved: false },
      data: {
        approved: true,
        approvedAt: expect.any(Date),
        approvedById: "user-a",
      },
    });
  });

  it("rejects a draft belonging to another tenant without updating it", async () => {
    vi.mocked(prisma.reviewReplyDraft.findFirst).mockResolvedValueOnce(null);

    await expect(approveReplyDraft("tenant-a", "draft-b")).rejects.toThrow(NotFoundError);
    expect(prisma.reviewReplyDraft.updateMany).not.toHaveBeenCalled();
  });

  it("rejects repeated approval", async () => {
    vi.mocked(prisma.reviewReplyDraft.findFirst).mockResolvedValueOnce({
      ...draft,
      approved: true,
    } as never);

    await expect(approveReplyDraft("tenant-a", "draft-a")).rejects.toThrow(ValidationError);
    expect(prisma.reviewReplyDraft.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a concurrent approval after the atomic transition loses the race", async () => {
    vi.mocked(prisma.reviewReplyDraft.findFirst)
      .mockResolvedValueOnce(draft as never)
      .mockResolvedValueOnce({ ...draft, approved: true } as never);
    vi.mocked(prisma.reviewReplyDraft.updateMany).mockResolvedValueOnce({ count: 0 });

    await expect(approveReplyDraft("tenant-a", "draft-a")).rejects.toThrow(ValidationError);
  });

  it("returns an edited approved draft to DRAFT", async () => {
    vi.mocked(prisma.reviewReplyDraft.findFirst)
      .mockResolvedValueOnce({ ...draft, approved: true } as never)
      .mockResolvedValueOnce({
        ...draft,
        content: "Edited content",
        approved: false,
        approvedAt: null,
        approvedById: null,
      } as never);
    vi.mocked(prisma.reviewReplyDraft.updateMany).mockResolvedValueOnce({ count: 1 });

    await updateReplyDraft("tenant-a", "draft-a", "Edited content");

    expect(prisma.reviewReplyDraft.updateMany).toHaveBeenCalledWith({
      where: { id: "draft-a", tenantId: "tenant-a" },
      data: {
        content: "Edited content",
        updatedAt: expect.any(Date),
        approved: false,
        approvedAt: null,
        approvedById: null,
      },
    });
  });

  it("returns a regenerated approved draft to DRAFT without changing the Google review", async () => {
    vi.mocked(prisma.googleReview.findFirst).mockResolvedValueOnce({
      id: "review-a",
      tenantId: "tenant-a",
      reviewerDisplayName: "Reviewer",
      starRating: 5,
      comment: "Great",
      replyComment: "Existing Google reply",
    } as never);
    vi.mocked(prisma.reviewReplyDraft.upsert).mockResolvedValueOnce({
      ...draft,
      content: "Regenerated content",
      approved: false,
      approvedAt: null,
      approvedById: null,
    } as never);

    await regenerateReplyDraft("tenant-a", "review-a", {
      generateReviewDraft: vi.fn(),
      generateReplyDraft: vi.fn().mockResolvedValue({ content: "Regenerated content" }),
    });

    expect(prisma.reviewReplyDraft.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          content: "Regenerated content",
          updatedAt: expect.any(Date),
          approved: false,
          approvedAt: null,
          approvedById: null,
        },
      })
    );
    expect(prisma.googleReview.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe("Feature 07 - approval server action boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the authenticated tenant and user for approval", async () => {
    const approveOperation = vi.fn().mockResolvedValue({
      id: "draft-a",
      tenantId: "tenant-a",
      googleReviewId: "review-a",
      content: "Approved content",
      approved: true,
      approvedAt: new Date("2026-09-16T11:00:00Z"),
      approvedById: "user-a",
    });
    vi.doMock("@/domains/reviews", () => ({
      approveReplyDraftRequestSchema,
      approveReplyDraft: approveOperation,
    }));
    const { requireTenantAdmin } = await import("@/domains/auth");
    vi.mocked(requireTenantAdmin).mockResolvedValue({
      tenantId: "tenant-a",
      tenantName: "Tenant A",
      tenantSlug: "tenant-a",
      role: "ADMIN",
      userId: "user-a",
    });

    const { approveReplyDraftAction } = await import("@/app/admin/google/reviews/reply-actions");
    const result = await approveReplyDraftAction("tenant-b", "draft-a");

    expect(result.success).toBe(true);
    expect(requireTenantAdmin).toHaveBeenCalledWith("tenant-b");
    expect(approveOperation).toHaveBeenCalledWith("tenant-a", "draft-a", "user-a");
    expect(approveOperation).not.toHaveBeenCalledWith("tenant-b", "draft-a", expect.anything());
  });

  it("rejects unauthenticated approval", async () => {
    const { requireTenantAdmin } = await import("@/domains/auth");
    vi.mocked(requireTenantAdmin).mockRejectedValueOnce(new AuthorizationError("Authentication required"));

    const { approveReplyDraftAction } = await import("@/app/admin/google/reviews/reply-actions");
    const result = await approveReplyDraftAction("tenant-a", "draft-a");

    expect(result.success).toBe(false);
    expect(result.message).toContain("Authentication required");
  });

  it("rejects a public feedback token", async () => {
    const { requireTenantAdmin } = await import("@/domains/auth");
    vi.mocked(requireTenantAdmin).mockRejectedValueOnce(
      new AuthorizationError("Public feedback tokens cannot be used to perform administrative operations")
    );

    const { approveReplyDraftAction } = await import("@/app/admin/google/reviews/reply-actions");
    const result = await approveReplyDraftAction("public-token", "draft-a");

    expect(result.success).toBe(false);
    expect(result.message).toContain("Public feedback tokens");
  });

  it("rejects a non-admin authorization result before calling the domain", async () => {
    const { requireTenantAdmin } = await import("@/domains/auth");
    vi.mocked(requireTenantAdmin).mockRejectedValueOnce(new AuthorizationError("Admin role required"));

    const { approveReplyDraftAction } = await import("@/app/admin/google/reviews/reply-actions");
    const result = await approveReplyDraftAction("tenant-a", "draft-a");

    expect(result.success).toBe(false);
    expect(result.message).toContain("Admin role required");
  });
});
