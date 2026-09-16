import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateReviewDraft,
  generateReviewDraftRequestSchema,
  reviewDraftOutputSchema,
  reviewDraftInputSchema,
  DRAFT_MAX_LENGTH,
  type AIProvider,
} from "@/domains/reviews";
import { getAIProvider, REVIEW_DRAFT_SYSTEM_PROMPT } from "@/domains/ai";
import { NotFoundError, ValidationError, ExternalServiceError } from "@/lib/errors";
import { prisma } from "@/lib/db";

// Mock the database client
vi.mock("@/lib/db", () => ({
  prisma: {
    feedbackSubmission: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    reviewDraft: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe("Feature 03 — AI-Assisted Review Draft Domain Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSubmission = {
    id: "sub-100",
    tenantId: "tenant-rm-1",
    rating: 5,
    feedback: "The website and chatbots delivered by RM Solution were awesome!",
    createdAt: new Date("2026-09-16T10:00:00Z"),
    updatedAt: new Date("2026-09-16T10:00:00Z"),
    tenant: {
      id: "tenant-rm-1",
      name: "RM Solution",
    },
    selectedServices: [
      { id: "fs-1", serviceName: "Website Development", createdAt: new Date() },
      { id: "fs-2", serviceName: "AI Chatbots", createdAt: new Date() },
    ],
  };

  const mockSuccessfulProvider: AIProvider = {
    generateReviewDraft: vi.fn().mockResolvedValue({
      draft: "RM Solution built a fantastic website and chatbot for our business. Highly recommended!",
    }),
  };

  describe("Validation Schemas", () => {
    it("should accept a valid submissionId request", () => {
      const res = generateReviewDraftRequestSchema.safeParse({ submissionId: "sub-100" });
      expect(res.success).toBe(true);
    });

    it("should reject an empty submissionId request", () => {
      const res = generateReviewDraftRequestSchema.safeParse({ submissionId: "" });
      expect(res.success).toBe(false);
    });

    it("should validate and trim valid AI output", () => {
      const res = reviewDraftOutputSchema.safeParse("  Great service! Highly recommend.  ");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toBe("Great service! Highly recommend.");
      }
    });

    it("should reject empty AI output", () => {
      const res = reviewDraftOutputSchema.safeParse("   ");
      expect(res.success).toBe(false);
    });

    it("should reject overly long AI output exceeding DRAFT_MAX_LENGTH", () => {
      const longOutput = "a".repeat(DRAFT_MAX_LENGTH + 1);
      const res = reviewDraftOutputSchema.safeParse(longOutput);
      expect(res.success).toBe(false);
    });

    it("should validate domain input prepared for the AI provider", () => {
      const res = reviewDraftInputSchema.safeParse({
        businessName: "RM Solution",
        serviceNames: ["Website Development"],
        overallRating: 5,
        customerFeedback: "Great job!",
      });
      expect(res.success).toBe(true);
    });
  });

  describe("Domain Service: generateReviewDraft", () => {
    it("should generate and persist a review draft for valid feedback", async () => {
      vi.mocked(prisma.feedbackSubmission.findUnique).mockResolvedValueOnce(
        mockSubmission as never
      );

      const persistedDraft = {
        id: "draft-1",
        tenantId: "tenant-rm-1",
        feedbackSubmissionId: "sub-100",
        draft: "RM Solution built a fantastic website and chatbot for our business. Highly recommended!",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.reviewDraft.upsert).mockResolvedValueOnce(persistedDraft as never);

      const result = await generateReviewDraft(
        { submissionId: "sub-100" },
        mockSuccessfulProvider
      );

      expect(result.submissionId).toBe("sub-100");
      expect(result.draft).toBe(persistedDraft.draft);
      expect(mockSuccessfulProvider.generateReviewDraft).toHaveBeenCalledWith({
        businessName: "RM Solution",
        serviceNames: ["Website Development", "AI Chatbots"],
        overallRating: 5,
        customerFeedback: "The website and chatbots delivered by RM Solution were awesome!",
      });

      // Assert tenant scoping in persistence
      expect(prisma.reviewDraft.upsert).toHaveBeenCalledWith({
        where: { feedbackSubmissionId: "sub-100" },
        update: {
          draft: "RM Solution built a fantastic website and chatbot for our business. Highly recommended!",
          tenantId: "tenant-rm-1",
        },
        create: {
          feedbackSubmissionId: "sub-100",
          tenantId: "tenant-rm-1",
          draft: "RM Solution built a fantastic website and chatbot for our business. Highly recommended!",
        },
      });

      // Assert original FeedbackSubmission.feedback was NOT modified
      expect(prisma.feedbackSubmission.update).not.toHaveBeenCalled();
    });

    it("should handle submission with empty/null feedback safely", async () => {
      const submissionNoFeedback = {
        ...mockSubmission,
        feedback: null,
      };
      vi.mocked(prisma.feedbackSubmission.findUnique).mockResolvedValueOnce(
        submissionNoFeedback as never
      );

      vi.mocked(prisma.reviewDraft.upsert).mockResolvedValueOnce({
        id: "draft-2",
        tenantId: "tenant-rm-1",
        feedbackSubmissionId: "sub-100",
        draft: "I used RM Solution for Website Development and AI Chatbots. Good experience.",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      await generateReviewDraft(
        { submissionId: "sub-100" },
        mockSuccessfulProvider
      );

      expect(mockSuccessfulProvider.generateReviewDraft).toHaveBeenCalledWith({
        businessName: "RM Solution",
        serviceNames: ["Website Development", "AI Chatbots"],
        overallRating: 5,
        customerFeedback: null,
      });
    });

    it("should throw NotFoundError for nonexistent submission", async () => {
      vi.mocked(prisma.feedbackSubmission.findUnique).mockResolvedValueOnce(null);

      await expect(
        generateReviewDraft(
          { submissionId: "nonexistent-id" },
          mockSuccessfulProvider
        )
      ).rejects.toThrow(NotFoundError);

      expect(mockSuccessfulProvider.generateReviewDraft).not.toHaveBeenCalled();
      expect(prisma.reviewDraft.upsert).not.toHaveBeenCalled();
    });

    it("should throw ValidationError for invalid request payload", async () => {
      await expect(
        generateReviewDraft({ submissionId: "" }, mockSuccessfulProvider)
      ).rejects.toThrow(ValidationError);
    });

    it("should handle AI provider failure gracefully as ExternalServiceError", async () => {
      vi.mocked(prisma.feedbackSubmission.findUnique).mockResolvedValueOnce(
        mockSubmission as never
      );

      const failingProvider: AIProvider = {
        generateReviewDraft: vi.fn().mockRejectedValue(new Error("AI service timeout")),
      };

      await expect(
        generateReviewDraft({ submissionId: "sub-100" }, failingProvider)
      ).rejects.toThrow(ExternalServiceError);

      // Persistence must not be called on failure
      expect(prisma.reviewDraft.upsert).not.toHaveBeenCalled();
      expect(prisma.feedbackSubmission.update).not.toHaveBeenCalled();
    });

    it("should reject empty draft returned by AI provider", async () => {
      vi.mocked(prisma.feedbackSubmission.findUnique).mockResolvedValueOnce(
        mockSubmission as never
      );

      const emptyDraftProvider: AIProvider = {
        generateReviewDraft: vi.fn().mockResolvedValue({ draft: "   " }),
      };

      await expect(
        generateReviewDraft({ submissionId: "sub-100" }, emptyDraftProvider)
      ).rejects.toThrow(ExternalServiceError);

      expect(prisma.reviewDraft.upsert).not.toHaveBeenCalled();
    });

    it("should reject overly long draft returned by AI provider", async () => {
      vi.mocked(prisma.feedbackSubmission.findUnique).mockResolvedValueOnce(
        mockSubmission as never
      );

      const longDraftProvider: AIProvider = {
        generateReviewDraft: vi.fn().mockResolvedValue({ draft: "a".repeat(1001) }),
      };

      await expect(
        generateReviewDraft({ submissionId: "sub-100" }, longDraftProvider)
      ).rejects.toThrow(ExternalServiceError);

      expect(prisma.reviewDraft.upsert).not.toHaveBeenCalled();
    });
  });

  describe("Server Action: generateReviewDraftAction", () => {
    it("should return success response on valid generation", async () => {
      const { generateReviewDraftAction } = await import(
        "@/app/feedback/[publicToken]/actions"
      );

      vi.mocked(prisma.feedbackSubmission.findUnique).mockResolvedValueOnce(
        mockSubmission as never
      );

      const mockDate = new Date();
      vi.mocked(prisma.reviewDraft.upsert).mockResolvedValueOnce({
        id: "draft-10",
        tenantId: "tenant-rm-1",
        feedbackSubmissionId: "sub-100",
        draft: "Great service from RM Solution!",
        createdAt: mockDate,
        updatedAt: mockDate,
      } as never);

      const result = await generateReviewDraftAction("sub-100");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.submissionId).toBe("sub-100");
        expect(result.data.draft).toBeDefined();
      }
    });

    it("should return safe error response on NotFoundError", async () => {
      const { generateReviewDraftAction } = await import(
        "@/app/feedback/[publicToken]/actions"
      );

      vi.mocked(prisma.feedbackSubmission.findUnique).mockResolvedValueOnce(null);

      const result = await generateReviewDraftAction("non-existent-sub");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.form[0]).toContain("could not be found");
      }
    });

    it("should return safe error response on ExternalServiceError without exposing keys or internals", async () => {
      const { generateReviewDraftAction } = await import(
        "@/app/feedback/[publicToken]/actions"
      );

      vi.mocked(prisma.feedbackSubmission.findUnique).mockResolvedValueOnce(
        mockSubmission as never
      );

      // Force provider error by throwing inside mockups
      vi.mocked(prisma.reviewDraft.upsert).mockImplementationOnce(() => {
        throw new Error("DB crash");
      });

      const result = await generateReviewDraftAction("sub-100");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.form[0]).not.toContain("API_KEY");
        expect(result.errors.form[0]).not.toContain("stack");
        expect(result.errors.form[0]).toContain("unexpected error");
      }
    });
  });

  describe("AI Domain Utilities", () => {
    it("should resolve the configured AIProvider instance", () => {
      const provider = getAIProvider();
      expect(provider).toBeDefined();
      expect(typeof provider.generateReviewDraft).toBe("function");
    });

    it("system prompt should contain non-manipulative review drafting instructions", () => {
      expect(REVIEW_DRAFT_SYSTEM_PROMPT).toContain("customer");
      expect(REVIEW_DRAFT_SYSTEM_PROMPT).toContain("first-person");
      expect(REVIEW_DRAFT_SYSTEM_PROMPT).toContain("NEVER invent specific details");
      expect(REVIEW_DRAFT_SYSTEM_PROMPT).toContain("Do NOT include manipulative language");
    });
  });
});