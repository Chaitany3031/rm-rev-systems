import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  feedbackSubmissionSchema,
  FEEDBACK_MAX_LENGTH,
  submitFeedback,
} from "@/domains/feedback";
import { getTenantByPublicToken } from "@/domains/tenants";
import { getActiveServicesForTenant } from "@/domains/services";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/db";

// Mock the db module
vi.mock("@/lib/db", () => ({
  prisma: {
    tenant: {
      findUnique: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
    feedbackSubmission: {
      create: vi.fn(),
    },
    feedbackService: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("Feature 02 — Public Customer Feedback Domain Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Validation Schema (feedbackSubmissionSchema)", () => {
    const validPayload = {
      publicToken: "rm-solution-dev",
      rating: 5,
      serviceIds: ["srv-1", "srv-2"],
      feedback: "Excellent web development and automation services!",
    };

    it("should accept a valid submission payload", () => {
      const parsed = feedbackSubmissionSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.publicToken).toBe("rm-solution-dev");
        expect(parsed.data.rating).toBe(5);
        expect(parsed.data.serviceIds).toEqual(["srv-1", "srv-2"]);
        expect(parsed.data.feedback).toBe("Excellent web development and automation services!");
      }
    });

    it("should accept valid submission without feedback (optional)", () => {
      const parsed = feedbackSubmissionSchema.safeParse({
        publicToken: "rm-solution-dev",
        rating: 4,
        serviceIds: ["srv-1"],
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.feedback).toBeNull();
      }
    });

    it("should normalize whitespace-only feedback to null", () => {
      const parsed = feedbackSubmissionSchema.safeParse({
        publicToken: "rm-solution-dev",
        rating: 4,
        serviceIds: ["srv-1"],
        feedback: "    \n\t  ",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.feedback).toBeNull();
      }
    });

    it("should deduplicate duplicate service IDs", () => {
      const parsed = feedbackSubmissionSchema.safeParse({
        publicToken: "rm-solution-dev",
        rating: 5,
        serviceIds: ["srv-1", "srv-2", "srv-1", "srv-2"],
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.serviceIds).toEqual(["srv-1", "srv-2"]);
      }
    });

    it("should reject missing or empty serviceIds", () => {
      const parsedEmpty = feedbackSubmissionSchema.safeParse({
        publicToken: "rm-solution-dev",
        rating: 5,
        serviceIds: [],
      });
      expect(parsedEmpty.success).toBe(false);

      const parsedMissing = feedbackSubmissionSchema.safeParse({
        publicToken: "rm-solution-dev",
        rating: 5,
      });
      expect(parsedMissing.success).toBe(false);
    });

    it("should reject rating below MIN_RATING (1)", () => {
      const parsed = feedbackSubmissionSchema.safeParse({
        ...validPayload,
        rating: 0,
      });
      expect(parsed.success).toBe(false);
    });

    it("should reject rating above MAX_RATING (5)", () => {
      const parsed = feedbackSubmissionSchema.safeParse({
        ...validPayload,
        rating: 6,
      });
      expect(parsed.success).toBe(false);
    });

    it("should reject non-integer ratings", () => {
      const parsed = feedbackSubmissionSchema.safeParse({
        ...validPayload,
        rating: 4.5,
      });
      expect(parsed.success).toBe(false);
    });

    it("should reject feedback exceeding max length", () => {
      const longFeedback = "a".repeat(FEEDBACK_MAX_LENGTH + 1);
      const parsed = feedbackSubmissionSchema.safeParse({
        ...validPayload,
        feedback: longFeedback,
      });
      expect(parsed.success).toBe(false);
    });

    it("should accept feedback exactly at max length", () => {
      const maxFeedback = "a".repeat(FEEDBACK_MAX_LENGTH);
      const parsed = feedbackSubmissionSchema.safeParse({
        ...validPayload,
        feedback: maxFeedback,
      });
      expect(parsed.success).toBe(true);
    });

    it("should reject missing publicToken", () => {
      const parsed = feedbackSubmissionSchema.safeParse({
        ...validPayload,
        publicToken: "",
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("Tenant Resolution (getTenantByPublicToken)", () => {
    it("should resolve a tenant by valid publicToken", async () => {
      const mockTenant = {
        id: "tenant-rm-1",
        name: "RM Solution",
        slug: "rm-solution",
        publicToken: "rm-solution-dev",
        description: "Digital systems & automation",
      };

      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);

      const tenant = await getTenantByPublicToken("rm-solution-dev");
      expect(tenant).toEqual(mockTenant);
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
    });

    it("should return null for non-existent token", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(null);

      const tenant = await getTenantByPublicToken("invalid-token");
      expect(tenant).toBeNull();
    });

    it("should return null for empty or whitespace publicToken without db call", async () => {
      const res1 = await getTenantByPublicToken("");
      const res2 = await getTenantByPublicToken("   ");
      expect(res1).toBeNull();
      expect(res2).toBeNull();
      expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("Service Catalog Query (getActiveServicesForTenant)", () => {
    it("should return only active services ordered properly", async () => {
      const mockServices = [
        { id: "srv-1", name: "Website Development", description: "Responsive sites", order: 1 },
        { id: "srv-2", name: "CRM Software", description: "Lead tracking", order: 2 },
      ];

      vi.mocked(prisma.service.findMany).mockResolvedValueOnce(mockServices as never);

      const result = await getActiveServicesForTenant("tenant-rm-1");
      expect(result).toEqual(mockServices);
      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-rm-1",
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
          order: true,
        },
        orderBy: [
          { order: "asc" },
          { createdAt: "asc" },
        ],
      });
    });

    it("should return empty array for empty tenantId without db query", async () => {
      const result = await getActiveServicesForTenant("");
      expect(result).toEqual([]);
      expect(prisma.service.findMany).not.toHaveBeenCalled();
    });
  });

  describe("Feedback Submission Service (submitFeedback)", () => {
    const mockTenant = {
      id: "tenant-rm-1",
      name: "RM Solution",
      slug: "rm-solution",
      publicToken: "rm-solution-dev",
      description: "Digital systems",
    };

    const mockActiveServices = [
      { id: "srv-1", name: "Website Development" },
      { id: "srv-2", name: "CRM Software" },
      { id: "srv-3", name: "AI Chatbots" },
    ];

    it("should successfully persist valid feedback and historical service snapshots", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      vi.mocked(prisma.service.findMany).mockResolvedValueOnce(mockActiveServices as never);

      const createdSubmission = {
        id: "sub-123",
        tenantId: "tenant-rm-1",
        rating: 5,
        feedback: "Awesome service!",
        createdAt: new Date("2026-09-16T10:00:00.000Z"),
        updatedAt: new Date("2026-09-16T10:00:00.000Z"),
      };

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        const tx = {
          feedbackSubmission: {
            create: vi.fn().mockResolvedValueOnce(createdSubmission),
          },
          feedbackService: {
            createMany: vi.fn().mockResolvedValueOnce({ count: 2 }),
          },
        };
        return (callback as unknown as (transaction: typeof tx) => Promise<unknown>)(tx);
      });

      const result = await submitFeedback({
        publicToken: "rm-solution-dev",
        rating: 5,
        serviceIds: ["srv-1", "srv-2"],
        feedback: "Awesome service!",
      });

      expect(result).toEqual({
        submissionId: "sub-123",
        createdAt: createdSubmission.createdAt,
        tenantName: "RM Solution",
      });
    });

    it("should reject submission when tenant is not found (invalid public token)", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(null);

      await expect(
        submitFeedback({
          publicToken: "invalid-token",
          rating: 5,
          serviceIds: ["srv-1"],
          feedback: "Great",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("should reject submission with cross-tenant or non-existent service ID", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      // Tenant active services only include srv-1, srv-2, srv-3
      vi.mocked(prisma.service.findMany).mockResolvedValueOnce(mockActiveServices as never);

      await expect(
        submitFeedback({
          publicToken: "rm-solution-dev",
          rating: 5,
          serviceIds: ["srv-1", "foreign-tenant-service-id"],
          feedback: "Great",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should reject submission with inactive service ID", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as never);
      // Service srv-inactive is not returned in activeServices
      vi.mocked(prisma.service.findMany).mockResolvedValueOnce([
        { id: "srv-1", name: "Website Development" },
      ] as never);

      await expect(
        submitFeedback({
          publicToken: "rm-solution-dev",
          rating: 4,
          serviceIds: ["srv-1", "srv-inactive"],
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should reject submission with missing rating", async () => {
      await expect(
        submitFeedback({
          publicToken: "rm-solution-dev",
          serviceIds: ["srv-1"],
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should reject submission with empty serviceIds", async () => {
      await expect(
        submitFeedback({
          publicToken: "rm-solution-dev",
          rating: 5,
          serviceIds: [],
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("Server Action (submitFeedbackAction)", () => {
    it("should return success state on valid submission", async () => {
      const { submitFeedbackAction } = await import("@/app/feedback/[publicToken]/actions");

      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({
        id: "tenant-rm-1",
        name: "RM Solution",
        slug: "rm-solution",
        publicToken: "rm-solution-dev",
        description: "Digital systems",
      } as never);

      vi.mocked(prisma.service.findMany).mockResolvedValueOnce([
        { id: "srv-1", name: "Website Development" },
      ] as never);

      const submissionDate = new Date();
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        const tx = {
          feedbackSubmission: {
            create: vi.fn().mockResolvedValueOnce({
              id: "sub-999",
              createdAt: submissionDate,
            }),
          },
          feedbackService: {
            createMany: vi.fn().mockResolvedValueOnce({ count: 1 }),
          },
        };
        return (callback as unknown as (transaction: typeof tx) => Promise<unknown>)(tx);
      });

      const result = await submitFeedbackAction({
        publicToken: "rm-solution-dev",
        rating: 5,
        serviceIds: ["srv-1"],
        feedback: "Super clean work",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.submissionId).toBe("sub-999");
        expect(result.data.tenantName).toBe("RM Solution");
      }
    });

    it("should return safe error state on ValidationError", async () => {
      const { submitFeedbackAction } = await import("@/app/feedback/[publicToken]/actions");

      const result = await submitFeedbackAction({
        publicToken: "rm-solution-dev",
        rating: 10, // Invalid rating
        serviceIds: ["srv-1"],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.rating).toBeDefined();
      }
    });

    it("should return safe error state on NotFoundError", async () => {
      const { submitFeedbackAction } = await import("@/app/feedback/[publicToken]/actions");

      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(null);

      const result = await submitFeedbackAction({
        publicToken: "non-existent-token",
        rating: 5,
        serviceIds: ["srv-1"],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.form).toBeDefined();
        expect(result.errors.form[0]).toContain("invalid or no longer active");
      }
    });
  });
});
