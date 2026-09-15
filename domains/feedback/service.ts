import { prisma } from "@/lib/db";
import { getTenantByPublicToken } from "@/domains/tenants";
import { ValidationError, NotFoundError, log } from "@/lib/errors";
import { safeParse } from "@/lib/validation";
import { feedbackSubmissionSchema } from "./validation";
import type { FeedbackSubmissionResult } from "./types";

/**
 * Submits public customer feedback for a tenant.
 *
 * Enforces:
 * - Opaque public token resolution (no raw tenant IDs from client)
 * - Required 1-5 integer rating
 * - At least one selected service
 * - Service existence, active status, and tenant ownership
 * - Max length constraints on optional feedback
 * - Historical snapshot preservation of service names
 * - Atomic persistence in a transaction
 */
export async function submitFeedback(
  input: unknown
): Promise<FeedbackSubmissionResult> {
  // 1. Validate payload structure
  const parseResult = safeParse(feedbackSubmissionSchema, input);
  if (!parseResult.success) {
    throw new ValidationError(
      "Invalid feedback submission data",
      parseResult.errors
    );
  }

  const { publicToken, rating, serviceIds, feedback } = parseResult.data;

  // 2. Resolve tenant by public token
  const tenant = await getTenantByPublicToken(publicToken);
  if (!tenant) {
    throw new NotFoundError(
      "Business not found for the provided feedback link"
    );
  }

  // 3. Load active services belonging specifically to this tenant
  const activeServices = await prisma.service.findMany({
    where: {
      tenantId: tenant.id,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
    },
  });

  const activeServiceMap = new Map(activeServices.map((s) => [s.id, s.name]));

  // 4. Verify all selected services exist, are active, and belong to this tenant
  const invalidServiceIds = serviceIds.filter((id) => !activeServiceMap.has(id));

  if (invalidServiceIds.length > 0) {
    throw new ValidationError(
      "One or more selected services are invalid, inactive, or do not belong to this business",
      {
        serviceIds: [
          "One or more selected services are not valid for this business.",
        ],
      }
    );
  }

  // 5. Persist submission atomically
  const result = await prisma.$transaction(async (tx) => {
    const submission = await tx.feedbackSubmission.create({
      data: {
        tenantId: tenant.id,
        rating,
        feedback,
      },
    });

    // Create historical service snapshot records
    const serviceRecords = serviceIds.map((serviceId) => ({
      feedbackSubmissionId: submission.id,
      serviceId,
      serviceName: activeServiceMap.get(serviceId)!,
    }));

    await tx.feedbackService.createMany({
      data: serviceRecords,
    });

    return {
      submissionId: submission.id,
      createdAt: submission.createdAt,
      tenantName: tenant.name,
    };
  });

  log("info", "Customer feedback submitted successfully", {
    tenantId: tenant.id,
    submissionId: result.submissionId,
    rating,
    servicesCount: serviceIds.length,
  });

  return result;
}
