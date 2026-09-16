import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateReplyDraft,
  updateReplyDraft,
  regenerateReplyDraft,
  getReplyDraft,
  generateReplyDraftRequestSchema,
  replyDraftOutputSchema,
  replyDraftInputSchema,
  updateReplyDraftSchema,
  REPLY_DRAFT_MAX_LENGTH,
  type AIProvider,
} from "@/domains/reviews";
import {
  buildDeterministicMockReply,
} from "@/domains/ai";
import { NotFoundError, ValidationError, ExternalServiceError } from "@/lib/errors";
import { prisma } from "@/lib/db";

// Mock the database client
vi.mock("@/lib/db", () => ({
  prisma: {
    googleReview: {
      findFirst: vi.fn(),
    },
    reviewReplyDraft: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("Feature 06 — AI Reply Draft Domain & Security Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockGoogleReview = {
    id: "google-review-1",
    tenantId: "tenant-rm-1",
    googleConnectionId: "conn-1",
    googleReviewName: "accounts/123/locations/456/reviews/789",
    googleLocationName: "accounts/123/locations/456",
    reviewerDisplayName: "Jane Reviewer",
    starRating: 4,
    comment: "Great service and fast turnaround!",
    reviewCreateTime: new Date("2026-09-15T10:00:00Z"),
    reviewUpdateTime: new Date("2026-09-15T10:00:00Z"),
    replyComment: null,
    replyUpdateTime: null,
    reviewReplyUrl: "https://search.google.com/local/reviews?placeid=abc",
    replyState: null,
    policyViolationCode: null,
    syncedAt: new Date("2026-09-16T09:00:00Z"),
    createdAt: new Date("2026-09-16T09:00:00Z"),
    updatedAt: new Date("2026-09-16T09:00:00Z"),
  };

  const mockSuccessfulProvider: AIProvider = {
    generateReviewDraft: vi.fn().mockResolvedValue({ draft: "unused" }),
    generateReplyDraft: vi.fn().mockResolvedValue({
      content: "Thank you for your feedback, we appreciate your business.",
    }),
  };

  describe("Validation Schemas", () => {
    it("should accept a valid googleReviewId request", () => {
      const res = generateReplyDraftRequestSchema.safeParse({
        googleReviewId: "google-review-1",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.googleReviewId).toBe("google-review-1");
      }
    });

    it("should reject an empty googleReviewId request", () => {
      const res = generateReplyDraftRequestSchema.safeParse({
        googleReviewId: "",
      });
      expect(res.success).toBe(false);
    });

    it("should validate and trim valid AI reply output", () => {
      const res = replyDraftOutputSchema.safeParse("  Thank you for your feedback.  ");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toBe("Thank you for your feedback.");
      }
    });

    it("should reject empty or whitespace-only AI reply output", () => {
      const resEmpty = replyDraftOutputSchema.safeParse("");
      const resWhitespace = replyDraftOutputSchema.safeParse("   ");
      expect(resEmpty.success).toBe(false);
      expect(resWhitespace.success).toBe(false);
    });

    it("should reject overly long AI reply output exceeding REPLY_DRAFT_MAX_LENGTH", () => {
      const longOutput = "a".repeat(REPLY_DRAFT_MAX_LENGTH + 1);
      const res = replyDraftOutputSchema.safeParse(longOutput);
      expect(res.success).toBe(false);
    });

    it("should validate domain reply input prepared for the AI provider", () => {
      const res = replyDraftInputSchema.safeParse({
        reviewerDisplayName: "Jane Reviewer",
        starRating: 4,
        comment: "Great service",
        replyComment: null,
      });
      expect(res.success).toBe(true);
    });

    it("should validate updateReplyDraftSchema with content", () => {
      const res = updateReplyDraftSchema.safeParse({ content: "Edited reply text" });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.content).toBe("Edited reply text");
      }
    });

    it("should reject empty content in updateReplyDraftSchema", () => {
      const res = updateReplyDraftSchema.safeParse({ content: "   " });
      expect(res.success).toBe(false);
    });
  });

  describe("Authorization & Tenant Isolation", () => {
    it("should load the review scoped strictly to the tenantId", async () => {
      // Simulate: a review exists but belongs to a different tenant → cross-tenant read denied
      prisma.googleReview.findFirst.mockResolvedValueOnce(null);

      await expect(
        generateReplyDraft("tenant-rm-1", "google-review-2", mockSuccessfulProvider)
      ).rejects.toThrow(NotFoundError);

      // Verify the query was tenant-scoped
      expect(prisma.googleReview.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "google-review-2",
            tenantId: "tenant-rm-1",
          },
        })
      );
      // AI must not be invoked for a cross-tenant review
      expect(mockSuccessfulProvider.generateReplyDraft).not.toHaveBeenCalled();
    });

    it("should store the reply draft scoped to the authenticated tenant", async () => {
      prisma.googleReview.findFirst.mockResolvedValueOnce(mockGoogleReview as never);
      (mockSuccessfulProvider.generateReplyDraft as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        { content: "Tenant-scoped reply" }
      );

      const persistedDraft = {
        id: "reply-draft-1",
        tenantId: "tenant-rm-1",
        googleReviewId: "google-review-1",
        content: "Tenant-scoped reply",
        provider: "mock",
        model: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.reviewReplyDraft.upsert.mockResolvedValueOnce(persistedDraft as never);

      const result = await generateReplyDraft("tenant-rm-1", "google-review-1", mockSuccessfulProvider);

      expect(result.tenantId).toBe("tenant-rm-1");
      expect(result.googleReviewId).toBe("google-review-1");

      // Verify the draft was persisted with the authenticated tenantId
      expect(prisma.reviewReplyDraft.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId_googleReviewId: expect.objectContaining({
              tenantId: "tenant-rm-1",
              googleReviewId: "google-review-1",
            }),
          }),
          create: expect.objectContaining({
            tenantId: "tenant-rm-1",
            googleReviewId: "google-review-1",
            content: "Tenant-scoped reply",
          }),
        })
      );
    });

    it("should reject update of a draft that does not belong to the tenant", async () => {
      prisma.reviewReplyDraft.findFirst.mockResolvedValueOnce(null);

      await expect(
        updateReplyDraft("tenant-rm-1", "draft-not-mine", "Edited content")
      ).rejects.toThrow(NotFoundError);

      // Verify the lookup was tenant-scoped
      expect(prisma.reviewReplyDraft.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "draft-not-mine",
            tenantId: "tenant-rm-1",
          },
        })
      );
    });
  });

  describe("Domain Service: generateReplyDraft", () => {
    it("should generate and persist a reply draft for a valid tenant-scoped review", async () => {
      prisma.googleReview.findFirst.mockResolvedValueOnce(mockGoogleReview as never);

      const persistedDraft = {
        id: "reply-draft-1",
        tenantId: "tenant-rm-1",
        googleReviewId: "google-review-1",
        content: "Thank you for your kind feedback, Jane! We're glad you had a great experience.",
        provider: "mock",
        model: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.reviewReplyDraft.upsert.mockResolvedValueOnce(persistedDraft as never);

      const result = await generateReplyDraft("tenant-rm-1", "google-review-1", mockSuccessfulProvider);

      expect(result.googleReviewId).toBe("google-review-1");
      expect(result.content).toBe(persistedDraft.content);
      expect(result.tenantId).toBe("tenant-rm-1");
      expect(result.id).toBe("reply-draft-1");
    });

    it("should pass grounded review data (not raw/untrusted) to the AI provider", async () => {
      prisma.googleReview.findFirst.mockResolvedValueOnce(mockGoogleReview as never);
      const spy = mockSuccessfulProvider.generateReplyDraft as ReturnType<typeof vi.fn>;
      spy.mockResolvedValueOnce({ content: "Grounded reply" });

      prisma.reviewReplyDraft.upsert.mockResolvedValueOnce({
        id: "reply-draft-1",
        tenantId: "tenant-rm-1",
        googleReviewId: "google-review-1",
        content: "Grounded reply",
        provider: "mock",
        model: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      await generateReplyDraft("tenant-rm-1", "google-review-1", mockSuccessfulProvider);

      expect(spy).toHaveBeenCalledTimes(1);
      const input = spy.mock.calls[0][0];
      expect(input.reviewerDisplayName).toBe("Jane Reviewer");
      expect(input.starRating).toBe(4);
      expect(input.comment).toBe("Great service and fast turnaround!");
      expect(input.replyComment).toBeUndefined();
    });

    it("should throw NotFoundError if the review does not exist for the tenant", async () => {
      prisma.googleReview.findFirst.mockResolvedValueOnce(null);

      await expect(
        generateReplyDraft("tenant-rm-1", "google-review-999", mockSuccessfulProvider)
      ).rejects.toThrow(NotFoundError);
    });

    it("should not invoke the AI provider for a missing review", async () => {
      prisma.googleReview.findFirst.mockResolvedValueOnce(null);

      await expect(
        generateReplyDraft("tenant-rm-1", "google-review-999", mockSuccessfulProvider)
      ).rejects.toThrow(NotFoundError);

      expect(mockSuccessfulProvider.generateReplyDraft).not.toHaveBeenCalled();
    });
  });

  describe("AI Provider Output Validation", () => {
    it("should reject empty AI reply output", async () => {
      prisma.googleReview.findFirst.mockResolvedValueOnce(mockGoogleReview as never);
      (mockSuccessfulProvider.generateReplyDraft as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: "   ",
      });

      await expect(
        generateReplyDraft("tenant-rm-1", "google-review-1", mockSuccessfulProvider)
      ).rejects.toThrow(ExternalServiceError);
    });

    it("should reject overly long AI reply output", async () => {
      prisma.googleReview.findFirst.mockResolvedValueOnce(mockGoogleReview as never);
      (mockSuccessfulProvider.generateReplyDraft as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: "a".repeat(REPLY_DRAFT_MAX_LENGTH + 1),
      });

      await expect(
        generateReplyDraft("tenant-rm-1", "google-review-1", mockSuccessfulProvider)
      ).rejects.toThrow(ExternalServiceError);
    });

    it("should propagate ExternalServiceError from the AI provider", async () => {
      prisma.googleReview.findFirst.mockResolvedValueOnce(mockGoogleReview as never);
      (mockSuccessfulProvider.generateReplyDraft as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new ExternalServiceError("MockProvider", "AI service unavailable")
      );

      await expect(
        generateReplyDraft("tenant-rm-1", "google-review-1", mockSuccessfulProvider)
      ).rejects.toThrow(ExternalServiceError);
    });

    it("should wrap non-ExternalServiceError provider failures as ExternalServiceError", async () => {
      prisma.googleReview.findFirst.mockResolvedValueOnce(mockGoogleReview as never);
      (mockSuccessfulProvider.generateReplyDraft as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Unexpected network failure")
      );

      await expect(
        generateReplyDraft("tenant-rm-1", "google-review-1", mockSuccessfulProvider)
      ).rejects.toThrow(ExternalServiceError);
    });
  });

  describe("Domain Service: updateReplyDraft", () => {
    it("should update an existing reply draft with new content", async () => {
      const existingDraft = {
        id: "reply-draft-1",
        tenantId: "tenant-rm-1",
        googleReviewId: "google-review-1",
        content: "Old content",
        provider: "mock",
        model: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.reviewReplyDraft.findFirst.mockResolvedValueOnce(existingDraft as never);

      const updated = {
        id: "reply-draft-1",
        tenantId: "tenant-rm-1",
        googleReviewId: "google-review-1",
        content: "New edited content",
        provider: "mock",
        model: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.reviewReplyDraft.update.mockResolvedValueOnce(updated as never);

      const result = await updateReplyDraft(
        "tenant-rm-1",
        "reply-draft-1",
        "New edited content"
      );

      expect(result.content).toBe("New edited content");
      expect(result.id).toBe("reply-draft-1");
      expect(prisma.reviewReplyDraft.update).toHaveBeenCalledWith({
        where: { id: "reply-draft-1" },
        data: { content: "New edited content", updatedAt: expect.any(Date) },
      });
    });

    it("should trim whitespace from updated content", async () => {
      const existingDraft = {
        id: "reply-draft-1",
        tenantId: "tenant-rm-1",
        googleReviewId: "google-review-1",
        content: "Old content",
        provider: "mock",
        model: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.reviewReplyDraft.findFirst.mockResolvedValueOnce(existingDraft as never);
      prisma.reviewReplyDraft.update.mockResolvedValueOnce({
        ...existingDraft,
        content: "Trimmed",
      } as never);

      const result = await updateReplyDraft("tenant-rm-1", "reply-draft-1", "   Trimmed   ");
      expect(result.content).toBe("Trimmed");
    });

    it("should reject empty content", async () => {
      await expect(
        updateReplyDraft("tenant-rm-1", "reply-draft-1", "")
      ).rejects.toThrow(ValidationError);
      expect(prisma.reviewReplyDraft.update).not.toHaveBeenCalled();
    });

    it("should reject whitespace-only content", async () => {
      await expect(
        updateReplyDraft("tenant-rm-1", "reply-draft-1", "   ")
      ).rejects.toThrow(ValidationError);
    });

    it("should reject content exceeding REPLY_DRAFT_MAX_LENGTH", async () => {
      await expect(
        updateReplyDraft("tenant-rm-1", "reply-draft-1", "a".repeat(REPLY_DRAFT_MAX_LENGTH + 1))
      ).rejects.toThrow(ValidationError);
      expect(prisma.reviewReplyDraft.update).not.toHaveBeenCalled();
    });

    it("should reject non-string content", async () => {
      await expect(
        updateReplyDraft("tenant-rm-1", "reply-draft-1", 123 as unknown as string)
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError if the draft does not belong to the tenant", async () => {
      prisma.reviewReplyDraft.findFirst.mockResolvedValueOnce(null);

      await expect(
        updateReplyDraft("tenant-rm-1", "reply-draft-999", "Edit")
      ).rejects.toThrow(NotFoundError);
      expect(prisma.reviewReplyDraft.update).not.toHaveBeenCalled();
    });
  });

  describe("Domain Service: regenerateReplyDraft", () => {
    it("should replace the current draft via upsert (one current draft per review)", async () => {
      prisma.googleReview.findFirst.mockResolvedValueOnce(mockGoogleReview as never);
      (mockSuccessfulProvider.generateReplyDraft as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: "Regenerated reply",
      });

      const regenerated = {
        id: "reply-draft-1",
        tenantId: "tenant-rm-1",
        googleReviewId: "google-review-1",
        content: "Regenerated reply",
        provider: "mock",
        model: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.reviewReplyDraft.upsert.mockResolvedValueOnce(regenerated as never);

      const result = await regenerateReplyDraft("tenant-rm-1", "google-review-1", mockSuccessfulProvider);

      expect(result.content).toBe("Regenerated reply");
      // Upsert uses the same unique composite key (one current draft per review)
      expect(prisma.reviewReplyDraft.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId_googleReviewId: { tenantId: "tenant-rm-1", googleReviewId: "google-review-1" } },
        })
      );
    });

    it("should leave GoogleReview unchanged after regeneration", async () => {
      prisma.googleReview.findFirst.mockResolvedValueOnce(mockGoogleReview as never);
      (mockSuccessfulProvider.generateReplyDraft as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        content: "New reply",
      });
      prisma.reviewReplyDraft.upsert.mockResolvedValueOnce({
        id: "reply-draft-1",
        tenantId: "tenant-rm-1",
        googleReviewId: "google-review-1",
        content: "New reply",
        provider: "mock",
        model: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      await regenerateReplyDraft("tenant-rm-1", "google-review-1", mockSuccessfulProvider);

      // The googleReview mock only has findFirst; if update were attempted it would throw.
      // Assert only the intended persistence model (reply draft) was written.
      expect(prisma.reviewReplyDraft.upsert).toHaveBeenCalled();
    });

    it("should throw NotFoundError for a non-existent review", async () => {
      prisma.googleReview.findFirst.mockResolvedValueOnce(null);

      await expect(
        regenerateReplyDraft("tenant-rm-1", "google-review-999", mockSuccessfulProvider)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("Domain Service: getReplyDraft", () => {
    it("should return null when no draft exists for the tenant's review", async () => {
      prisma.reviewReplyDraft.findFirst.mockResolvedValueOnce(null);

      const result = await getReplyDraft("tenant-rm-1", "google-review-1");
      expect(result).toBeNull();

      expect(prisma.reviewReplyDraft.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: "tenant-rm-1", googleReviewId: "google-review-1" },
        })
      );
    });

    it("should return the existing draft scoped to the tenant", async () => {
      const existing = {
        id: "reply-draft-1",
        tenantId: "tenant-rm-1",
        googleReviewId: "google-review-1",
        content: "Existing draft text",
        provider: "mock",
        model: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.reviewReplyDraft.findFirst.mockResolvedValueOnce(existing as never);

      const result = await getReplyDraft("tenant-rm-1", "google-review-1");
      expect(result).not.toBeNull();
      expect(result!.content).toBe("Existing draft text");
      expect(result!.tenantId).toBe("tenant-rm-1");
    });
  });

  describe("Mock AI Provider Reply Output", () => {
    it("should produce a deterministic, rating-aware reply", () => {
      const content = buildDeterministicMockReply({
        reviewerDisplayName: "Jane Reviewer",
        starRating: 5,
        comment: "Amazing team",
      });
      expect(content).toContain("Jane Reviewer");
      expect(content).toContain("Amazing team");
      expect(content).toMatch(/thank/i);
    });

    it("should produce a grounded reply that never hallucinates facts", () => {
      const content = buildDeterministicMockReply({
        reviewerDisplayName: "Bob",
        starRating: 3,
        comment: "Okay experience",
      });
      // Should not invent a price, product offering, or timeline
      expect(content).not.toMatch(/\$\d+|\$\d+\.\d{2}/);
      expect(content).not.toContain("2024");
      expect(content).not.toContain("2025");
      // Should reference supplied data only
      expect(content).toContain("Bob");
      expect(content).toContain("Okay experience");
    });

    it("should produce the configured provider's reply draft", async () => {
      const result = await mockSuccessfulProvider.generateReplyDraft({
        reviewerDisplayName: "Jane Reviewer",
        starRating: 4,
      });
      expect(typeof result.content).toBe("string");
      expect(result.content.trim().length).toBeGreaterThan(0);
      expect(result.content).toContain("feedback");
    });
  });
});