import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateReviewDraft,
  generateReviewDraftRequestSchema,
  reviewDraftOutputSchema,
  reviewDraftInputSchema,
  DRAFT_MAX_LENGTH,
  type AIProvider,
} from "@/domains/reviews";
import {
  getAIProvider,
  REVIEW_DRAFT_SYSTEM_PROMPT,
  buildDeterministicMockDraft,
} from "@/domains/ai";
import { NotFoundError, ValidationError, ExternalServiceError } from "@/lib/errors";
import { prisma } from "@/lib/db";

// Mock the database client
vi.mock("@/lib/db", () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(),
    },
    feedbackSubmission: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    reviewDraft: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe("Feature 03 — AI-Assisted Review Draft Domain & Security Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTenant = {
    id: "tenant-rm-1",
    name: "RM Solution",
    slug: "rm-solution",
    publicToken: "rm-solution-dev",
    description: "Digital systems",
  };

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
    it("should accept a valid publicToken and submissionId request", () => {
      const res = generateReviewDraftRequestSchema.safeParse({
        publicToken: "rm-solution-dev",
        submissionId: "sub-100",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.publicToken).toBe("rm-solution-dev");
        expect(res.data.submissionId).toBe("sub-100");
      }
    });

    it("should reject an empty submissionId request", () => {
      const res = generateReviewDraftRequestSchema.safeParse({
        publicToken: "rm-solution-dev",
        submissionId: "",
      });
      expect(res.success).toBe(false);
    });

    it("should reject an empty publicToken request", () => {
      const res = generateReviewDraftRequestSchema.safeParse({
        publicToken: "",
        submissionId: "sub-100",
      });
      expect(res.success).toBe(false);
    });

    it("should validate and trim valid AI output", () => {
      const res = reviewDraftOutputSchema.safeParse("  Great service! Highly recommend.  ");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toBe("Great service! Highly recommend.");
      }
    });

    it("should reject empty or whitespace-only AI output", () => {
      const resEmpty = reviewDraftOutputSchema.safeParse("");
      const resWhitespace = reviewDraftOutputSchema.safeParse("   ");
      expect(resEmpty.success).toBe(false);
      expect(resWhitespace.success).toBe(false);
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
    it("should generate and persist a review draft for valid tenant token and submission", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      vi.mocked(prisma.feedbackSubmission.findFirst).mockResolvedValueOnce(
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
        { publicToken: "rm-solution-dev", submissionId: "sub-100" },
        mockSuccessfulProvider
      );

      expect(result.submissionId).toBe("sub-100");
      expect(result.draft).toBe(persistedDraft.draft);

      // Verify tenant resolution was performed using public token
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { publicToken: "rm-solution-dev" },
        select: {
          id: true,
          name: true,
          slug: true,
          publicToken: true,
          description: true,
        },
      });

      // Verify submission query was strictly scoped to tenant.id
      expect(prisma.feedbackSubmission.findFirst).toHaveBeenCalledWith({
        where: {
          id: "sub-100",
          tenantId: "tenant-rm-1",
        },
        include: {
          tenant: true,
          selectedServices: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      // Verify AI provider invocation with structured domain input
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
      expect(prisma.feedbackSubmission.updateMany).not.toHaveBeenCalled();
    });

    it("SECURITY: rejects cross-tenant attack (Tenant A token + Tenant B submission)", async () => {
      // Tenant A resolves from token
      const tenantA = {
        id: "tenant-a-id",
        name: "Tenant Alpha",
        slug: "tenant-alpha",
        publicToken: "token-tenant-a",
        description: "Tenant A",
      };
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(tenantA as never);

      // Submission B belongs to Tenant B, so querying with { id: "sub-tenant-b", tenantId: "tenant-a-id" } returns null
      vi.mocked(prisma.feedbackSubmission.findFirst).mockResolvedValueOnce(null);

      await expect(
        generateReviewDraft(
          { publicToken: "token-tenant-a", submissionId: "sub-tenant-b" },
          mockSuccessfulProvider
        )
      ).rejects.toThrow(NotFoundError);

      // Verify submission query explicitly included tenant A's id to ensure isolation
      expect(prisma.feedbackSubmission.findFirst).toHaveBeenCalledWith({
        where: {
          id: "sub-tenant-b",
          tenantId: "tenant-a-id",
        },
        include: {
          tenant: true,
          selectedServices: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      // Crucial security checks: provider NOT called, review draft NOT created, feedback NOT modified
      expect(mockSuccessfulProvider.generateReviewDraft).not.toHaveBeenCalled();
      expect(prisma.reviewDraft.upsert).not.toHaveBeenCalled();
      expect(prisma.feedbackSubmission.update).not.toHaveBeenCalled();
    });

    it("should reject when public token is invalid/nonexistent without querying submissions", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(null);

      await expect(
        generateReviewDraft(
          { publicToken: "invalid-token", submissionId: "sub-100" },
          mockSuccessfulProvider
        )
      ).rejects.toThrow(NotFoundError);

      expect(prisma.feedbackSubmission.findFirst).not.toHaveBeenCalled();
      expect(mockSuccessfulProvider.generateReviewDraft).not.toHaveBeenCalled();
      expect(prisma.reviewDraft.upsert).not.toHaveBeenCalled();
    });

    it("should handle submission with empty/null feedback safely", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);

      const submissionNoFeedback = {
        ...mockSubmission,
        feedback: null,
      };
      vi.mocked(prisma.feedbackSubmission.findFirst).mockResolvedValueOnce(
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
        { publicToken: "rm-solution-dev", submissionId: "sub-100" },
        mockSuccessfulProvider
      );

      expect(mockSuccessfulProvider.generateReviewDraft).toHaveBeenCalledWith({
        businessName: "RM Solution",
        serviceNames: ["Website Development", "AI Chatbots"],
        overallRating: 5,
        customerFeedback: null,
      });
    });

    it("should throw NotFoundError for nonexistent submission under valid tenant", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      vi.mocked(prisma.feedbackSubmission.findFirst).mockResolvedValueOnce(null);

      await expect(
        generateReviewDraft(
          { publicToken: "rm-solution-dev", submissionId: "nonexistent-id" },
          mockSuccessfulProvider
        )
      ).rejects.toThrow(NotFoundError);

      expect(mockSuccessfulProvider.generateReviewDraft).not.toHaveBeenCalled();
      expect(prisma.reviewDraft.upsert).not.toHaveBeenCalled();
    });

    it("should throw ValidationError for invalid request payload", async () => {
      await expect(
        generateReviewDraft(
          { publicToken: "", submissionId: "" },
          mockSuccessfulProvider
        )
      ).rejects.toThrow(ValidationError);
    });

    it("should handle AI provider failure gracefully as ExternalServiceError", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      vi.mocked(prisma.feedbackSubmission.findFirst).mockResolvedValueOnce(
        mockSubmission as never
      );

      const failingProvider: AIProvider = {
        generateReviewDraft: vi.fn().mockRejectedValue(new Error("AI service timeout")),
      };

      await expect(
        generateReviewDraft(
          { publicToken: "rm-solution-dev", submissionId: "sub-100" },
          failingProvider
        )
      ).rejects.toThrow(ExternalServiceError);

      // Persistence must not be called on failure
      expect(prisma.reviewDraft.upsert).not.toHaveBeenCalled();
      expect(prisma.feedbackSubmission.update).not.toHaveBeenCalled();
    });

    it("should reject non-string draft returned by AI provider", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      vi.mocked(prisma.feedbackSubmission.findFirst).mockResolvedValueOnce(
        mockSubmission as never
      );

      const invalidTypeProvider: AIProvider = {
        generateReviewDraft: vi.fn().mockResolvedValue({ draft: null as unknown as string }),
      };

      await expect(
        generateReviewDraft(
          { publicToken: "rm-solution-dev", submissionId: "sub-100" },
          invalidTypeProvider
        )
      ).rejects.toThrow(ExternalServiceError);

      expect(prisma.reviewDraft.upsert).not.toHaveBeenCalled();
    });

    it("should reject empty draft returned by AI provider", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      vi.mocked(prisma.feedbackSubmission.findFirst).mockResolvedValueOnce(
        mockSubmission as never
      );

      const emptyDraftProvider: AIProvider = {
        generateReviewDraft: vi.fn().mockResolvedValue({ draft: "   " }),
      };

      await expect(
        generateReviewDraft(
          { publicToken: "rm-solution-dev", submissionId: "sub-100" },
          emptyDraftProvider
        )
      ).rejects.toThrow(ExternalServiceError);

      expect(prisma.reviewDraft.upsert).not.toHaveBeenCalled();
    });

    it("should reject overly long draft returned by AI provider", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      vi.mocked(prisma.feedbackSubmission.findFirst).mockResolvedValueOnce(
        mockSubmission as never
      );

      const longDraftProvider: AIProvider = {
        generateReviewDraft: vi.fn().mockResolvedValue({ draft: "a".repeat(1001) }),
      };

      await expect(
        generateReviewDraft(
          { publicToken: "rm-solution-dev", submissionId: "sub-100" },
          longDraftProvider
        )
      ).rejects.toThrow(ExternalServiceError);

      expect(prisma.reviewDraft.upsert).not.toHaveBeenCalled();
    });
  });

  describe("Deterministic Mock AI Provider (buildDeterministicMockDraft)", () => {
    it("should produce an enthusiastic 5-star draft incorporating services and feedback", () => {
      const draft = buildDeterministicMockDraft({
        businessName: "RM Solution",
        serviceNames: ["Website Development", "AI Chatbots"],
        overallRating: 5,
        customerFeedback: "The team exceeded our expectations!",
      });

      expect(draft).toContain("RM Solution");
      expect(draft).toContain("Website Development and AI Chatbots");
      expect(draft).toContain("excellent experience");
      expect(draft).toContain("very satisfied");
      expect(draft).toContain("The team exceeded our expectations!");
    });

    it("should produce a solid positive 4-star draft without exaggerated claims", () => {
      const draft = buildDeterministicMockDraft({
        businessName: "RM Solution",
        serviceNames: ["CRM Software"],
        overallRating: 4,
        customerFeedback: "Delivered on time.",
      });

      expect(draft).toContain("positive experience");
      expect(draft).toContain("CRM Software");
      expect(draft).toContain("Delivered on time.");
      expect(draft).not.toContain("very satisfied");
    });

    it("should produce a balanced neutral 3-star draft", () => {
      const draft = buildDeterministicMockDraft({
        businessName: "RM Solution",
        serviceNames: ["Business Automation"],
        overallRating: 3,
        customerFeedback: "Communication could be quicker.",
      });

      expect(draft).toContain("satisfactory, though there were areas that could be improved");
      expect(draft).toContain("Communication could be quicker.");
      expect(draft).not.toContain("excellent");
      expect(draft).not.toContain("recommend");
    });

    it("should produce a critical 2-star draft for low ratings", () => {
      const draft = buildDeterministicMockDraft({
        businessName: "RM Solution",
        serviceNames: ["Meta Ads"],
        overallRating: 2,
        customerFeedback: "Did not achieve desired campaign results.",
      });

      expect(draft).toContain("did not meet my expectations and there were several issues");
      expect(draft).toContain("Did not achieve desired campaign results.");
      expect(draft).not.toContain("excellent");
      expect(draft).not.toContain("satisfied");
    });

    it("should produce a dissatisfied 1-star draft for very poor ratings", () => {
      const draft = buildDeterministicMockDraft({
        businessName: "RM Solution",
        serviceNames: ["Website Development"],
        overallRating: 1,
        customerFeedback: "Project was not delivered as specified.",
      });

      expect(draft).toContain("disappointing experience");
      expect(draft).toContain("fell short of expectations");
      expect(draft).toContain("Project was not delivered as specified.");
      expect(draft).not.toContain("recommend");
      expect(draft).not.toContain("excellent");
    });

    it("should produce concise sensible draft when customer feedback is null or empty", () => {
      const draftNull = buildDeterministicMockDraft({
        businessName: "RM Solution",
        serviceNames: ["Website Development", "CRM Software", "AI Chatbots"],
        overallRating: 5,
        customerFeedback: null,
      });

      expect(draftNull).toContain("RM Solution");
      expect(draftNull).toContain("Website Development, CRM Software, and AI Chatbots");
      expect(draftNull).toContain("excellent experience");
      expect(draftNull.length).toBeGreaterThan(10);
      expect(draftNull.length).toBeLessThan(DRAFT_MAX_LENGTH);
    });

    it("MockAIProvider instance executes and returns deterministic output", async () => {
      const provider = getAIProvider();
      const output = await provider.generateReviewDraft({
        businessName: "RM Solution",
        serviceNames: ["Website Development"],
        overallRating: 5,
        customerFeedback: "Great work!",
      });

      expect(output).toBeDefined();
      expect(output.draft).toContain("RM Solution");
      expect(output.draft).toContain("Website Development");
      expect(output.draft).toContain("Great work!");
    });
  });

  describe("Server Action: generateReviewDraftAction", () => {
    it("should return success response on valid generation", async () => {
      const { generateReviewDraftAction } = await import(
        "@/app/feedback/[publicToken]/actions"
      );

      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      vi.mocked(prisma.feedbackSubmission.findFirst).mockResolvedValueOnce(
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

      const result = await generateReviewDraftAction({
        publicToken: "rm-solution-dev",
        submissionId: "sub-100",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.submissionId).toBe("sub-100");
        expect(result.data.draft).toBeDefined();
      }
    });

    it("SECURITY: server action rejects cross-tenant request safely", async () => {
      const { generateReviewDraftAction } = await import(
        "@/app/feedback/[publicToken]/actions"
      );

      // Tenant A token resolves Tenant A
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({
        id: "tenant-a-id",
        name: "Tenant A",
        slug: "tenant-a",
        publicToken: "token-tenant-a",
      } as never);

      // Submission B belongs to Tenant B, so findFirst returns null
      vi.mocked(prisma.feedbackSubmission.findFirst).mockResolvedValueOnce(null);

      const result = await generateReviewDraftAction({
        publicToken: "token-tenant-a",
        submissionId: "sub-belonging-to-tenant-b",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.form[0]).toContain("could not be found");
      }
      expect(prisma.reviewDraft.upsert).not.toHaveBeenCalled();
    });

    it("should return safe error response on ValidationError (missing fields)", async () => {
      const { generateReviewDraftAction } = await import(
        "@/app/feedback/[publicToken]/actions"
      );

      const result = await generateReviewDraftAction({
        publicToken: "",
        submissionId: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.publicToken).toBeDefined();
        expect(result.errors.submissionId).toBeDefined();
      }
    });

    it("should return safe error response on NotFoundError (invalid public token)", async () => {
      const { generateReviewDraftAction } = await import(
        "@/app/feedback/[publicToken]/actions"
      );

      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(null);

      const result = await generateReviewDraftAction({
        publicToken: "non-existent-token",
        submissionId: "sub-100",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.form[0]).toContain("could not be found");
      }
    });

    it("should return safe error response on unexpected failure without exposing keys or stack traces", async () => {
      const { generateReviewDraftAction } = await import(
        "@/app/feedback/[publicToken]/actions"
      );

      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      vi.mocked(prisma.feedbackSubmission.findFirst).mockResolvedValueOnce(
        mockSubmission as never
      );

      // Force unexpected error inside database upsert
      vi.mocked(prisma.reviewDraft.upsert).mockImplementationOnce(() => {
        throw new Error("DATABASE_CRASH_SECRET_KEY_12345");
      });

      const result = await generateReviewDraftAction({
        publicToken: "rm-solution-dev",
        submissionId: "sub-100",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.form[0]).not.toContain("DATABASE_CRASH");
        expect(result.errors.form[0]).not.toContain("SECRET_KEY");
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
