import { prisma } from "@/lib/db";
import { getTenantByPublicToken } from "@/domains/tenants";
import { ValidationError, NotFoundError, ExternalServiceError, log } from "@/lib/errors";
import { safeParse } from "@/lib/validation";
import { generateReviewDraftRequestSchema, DRAFT_MAX_LENGTH } from "./validation";
import type { AIProvider, ReviewDraftResult } from "./types";

/**
 * Application domain service for AI review-draft generation.
 *
 * Responsibilities:
 *   1. Validate the request parameters (publicToken + submissionId).
 *   2. Resolve the tenant strictly by opaque public token.
 *   3. Load the feedback submission scoped strictly to that tenant (cross-tenant denied).
 *   4. Prepare the AI input from data actually present in the feedback domain.
 *   5. Invoke the provider-agnostic `AIProvider`.
 *   6. Validate the raw AI output before persistence.
 *   7. Upsert the persisted ReviewDraft (tenant + submission ownership enforced).
 *
 * The original `FeedbackSubmission.feedback` is never modified. A provider
 * failure surfaces as an application error and preserves the original feedback.
 */
export async function generateReviewDraft(
  input: unknown,
  aiProvider: AIProvider
): Promise<ReviewDraftResult> {
  // 1. Validate the request identifiers (publicToken + submissionId)
  const parseResult = safeParse(generateReviewDraftRequestSchema, input);
  if (!parseResult.success) {
    throw new ValidationError("Invalid review-draft request", parseResult.errors);
  }

  const { publicToken, submissionId } = parseResult.data;

  // 2. Resolve the tenant from the opaque public token
  const tenant = await getTenantByPublicToken(publicToken);
  if (!tenant) {
    throw new NotFoundError("Business not found for the provided feedback link");
  }

  // 3. Load the feedback submission strictly scoped to this tenant.
  //    This rejects Tenant A token + Tenant B submissionId with NotFoundError.
  const submission = await prisma.feedbackSubmission.findFirst({
    where: {
      id: submissionId,
      tenantId: tenant.id,
    },
    include: {
      tenant: true,
      selectedServices: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!submission) {
    throw new NotFoundError("Feedback submission not found for this business");
  }

  // 4. Prepare the AI input strictly from the feedback domain.
  const domainInput = {
    businessName: submission.tenant.name,
    serviceNames: submission.selectedServices.map((s) => s.serviceName),
    overallRating: submission.rating,
    customerFeedback: submission.feedback,
  };

  // 5. Invoke the provider (may throw ExternalServiceError on failure).
  let output;
  try {
    output = await aiProvider.generateReviewDraft(domainInput);
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      throw error;
    }
    throw new ExternalServiceError("AIProvider", "AI review draft generation failed", {
      cause: error instanceof Error ? error : undefined,
    });
  }

  if (!output || typeof output.draft !== "string") {
    throw new ExternalServiceError("AIProvider", "AI provider returned an invalid response");
  }

  const draft = output.draft.trim();

  // 6. Validate the raw AI output.
  if (draft.length === 0) {
    throw new ExternalServiceError("AIProvider", "AI provider returned an empty review draft");
  }
  if (draft.length > DRAFT_MAX_LENGTH) {
    throw new ExternalServiceError(
      "AIProvider",
      `AI provider returned an overly long review draft exceeding ${DRAFT_MAX_LENGTH} characters`
    );
  }

  // 7. Persist the draft under the verified tenant.
  const persisted = await prisma.reviewDraft.upsert({
    where: {
      feedbackSubmissionId: submissionId,
    },
    update: {
      draft,
      tenantId: tenant.id,
    },
    create: {
      feedbackSubmissionId: submissionId,
      tenantId: tenant.id,
      draft,
    },
  });

  log("info", "AI review draft generated and persisted", {
    tenantId: tenant.id,
    submissionId,
    draftLength: draft.length,
  });

  return {
    submissionId,
    draft: persisted.draft,
    updatedAt: persisted.updatedAt,
  };
}
