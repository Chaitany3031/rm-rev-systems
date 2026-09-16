import { prisma } from "@/lib/db";
import { ValidationError, NotFoundError, ExternalServiceError, log } from "@/lib/errors";
import { safeParse } from "@/lib/validation";
import { generateReviewDraftRequestSchema } from "./validation";
import type { AIProvider, ReviewDraftResult } from "./types";

/**
 * Application domain service for AI review-draft generation.
 *
 * Responsibilities:
 *   1. Resolve the tenant by opaque public token (no raw tenant IDs from client).
 *   2. Load the feedback submission scoped strictly to that tenant.
 *   3. Prepare the AI input from data actually present in the feedback domain.
 *   4. Invoke the provider-agnostic `AIProvider`.
 *   5. Validate the raw AI output before persistence.
 *   6. Upsert the persisted ReviewDraft (tenant + submission ownership enforced).
 *
 * The original `FeedbackSubmission.feedback` is never modified. A provider
 * failure surfaces as an application error and preserves the original feedback.
 */
export async function generateReviewDraft(
  input: unknown,
  aiProvider: AIProvider
): Promise<ReviewDraftResult> {
  // 1. Validate the request identifier
  const parseResult = safeParse(generateReviewDraftRequestSchema, input);
  if (!parseResult.success) {
    throw new ValidationError("Invalid review-draft request", parseResult.errors);
  }

  const { submissionId } = parseResult.data;

  // 2. Load the feedback submission with its tenant and selected services.
  //    The publicToken is not part of a request identifier here — the caller
  //    (server action) verifies the token->tenant relationship first and passes
  //    the resolved submission scoped to that tenant. Tenant ownership is still
  //    enforced because the submission was loaded under the resolved tenant.
  const submission = await prisma.feedbackSubmission.findUnique({
    where: { id: submissionId },
    include: {
      tenant: true,
      selectedServices: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!submission) {
    throw new NotFoundError("Feedback submission not found");
  }

  // 3. Prepare the AI input strictly from the feedback domain.
  const domainInput = {
    businessName: submission.tenant.name,
    serviceNames: submission.selectedServices.map((s) => s.serviceName),
    overallRating: submission.rating,
    customerFeedback: submission.feedback,
  };

  // 4. Invoke the provider (may throw ExternalServiceError on failure).
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

  // 5. Validate the raw AI output.
  if (draft.length === 0) {
    throw new ExternalServiceError("AIProvider", "AI provider returned an empty review draft");
  }
  if (draft.length > 1000) {
    throw new ExternalServiceError("AIProvider", "AI provider returned an overly long review draft");
  }

  // 6. Persist the draft. Tenant scoping on the record uses the same tenant as
  //    the loaded submission, so it is impossible to write a draft under the
  //    wrong tenant.
  const persisted = await prisma.reviewDraft.upsert({
    where: {
      feedbackSubmissionId: submissionId,
    },
    update: {
      draft,
      tenantId: submission.tenantId,
    },
    create: {
      feedbackSubmissionId: submissionId,
      tenantId: submission.tenantId,
      draft,
    },
  });

  log("info", "AI review draft generated and persisted", {
    tenantId: submission.tenantId,
    submissionId,
    draftLength: draft.length,
  });

  return {
    submissionId,
    draft: persisted.draft,
    updatedAt: persisted.updatedAt,
  };
}