import { prisma } from "@/lib/db";
import {
  ValidationError,
  NotFoundError,
  ExternalServiceError,
  log,
} from "@/lib/errors";
import type { AIProvider } from "../reviews/types";
import type { ReplyDraftInput } from "./reply-validation";

/**
 * Result returned when generating or editing a reply draft.
 */
export interface ReplyDraftResult {
  id: string;
  tenantId: string;
  googleReviewId: string;
  content: string;
  provider?: string | null;
  model?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generate an AI reply draft for an existing GoogleReview.
 * Tenant ID is passed explicitly (resolved from authenticated session by caller).
 */
export async function generateReplyDraft(
  tenantId: string,
  googleReviewId: string,
  aiProvider: AIProvider
): Promise<ReplyDraftResult> {
  // Load the review scoped to this tenant
  const review = await prisma.googleReview.findFirst({
    where: {
      id: googleReviewId,
      tenantId,
    },
  });

  if (!review) {
    throw new NotFoundError("Google review not found");
  }

  // Build minimal AI input from permitted review data only
  const domainInput: ReplyDraftInput = {
    reviewerDisplayName: review.reviewerDisplayName ?? undefined,
    starRating: review.starRating ?? undefined,
    comment: review.comment ?? undefined,
    replyComment: review.replyComment ?? undefined,
  };

  // Invoke the AI provider
  let output;
  try {
    output = await aiProvider.generateReplyDraft(domainInput);
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      throw error;
    }
    throw new ExternalServiceError("AIProvider", "AI reply draft generation failed", {
      cause: error instanceof Error ? error : undefined,
    });
  }

  // Validate AI result
  if (!output || typeof output.content !== "string") {
    throw new ExternalServiceError("AIProvider", "AI provider returned an invalid response");
  }

  const content = output.content.trim();

  if (content.length === 0) {
    throw new ExternalServiceError("AIProvider", "AI provider returned an empty reply draft");
  }
  if (content.length > 1000) {
    throw new ExternalServiceError(
      "AIProvider",
      "AI provider returned an overly long reply draft exceeding 1000 characters"
    );
  }

  // Persist the draft (upsert: one current draft per tenant+review)
  const now = new Date();
  const persisted = await prisma.reviewReplyDraft.upsert({
    where: {
      tenantId_googleReviewId: {
        tenantId,
        googleReviewId,
      },
    },
    update: {
      content,
      updatedAt: now,
    },
    create: {
      tenantId,
      googleReviewId,
      content,
    },
  });

  log("info", "AI reply draft generated and persisted", {
    tenantId,
    googleReviewId,
    contentLength: content.length,
  });

  return {
    id: persisted.id,
    tenantId: persisted.tenantId,
    googleReviewId: persisted.googleReviewId,
    content: persisted.content,
    provider: persisted.provider,
    model: persisted.model,
    createdAt: persisted.createdAt,
    updatedAt: persisted.updatedAt,
  };
}

/**
 * Edit an existing reply draft.
 * Authorization: draft must belong to the authenticated tenant.
 */
export async function updateReplyDraft(
  tenantId: string,
  draftId: string,
  content: string
): Promise<ReplyDraftResult> {
  // Validate content server-side
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    throw new ValidationError("Reply draft content cannot be empty");
  }
  if (content.length > 1000) {
    throw new ValidationError("Reply draft cannot exceed 1000 characters");
  }

  // Find draft scoped to tenant
  const existing = await prisma.reviewReplyDraft.findFirst({
    where: {
      id: draftId,
      tenantId,
    },
  });

  if (!existing) {
    throw new NotFoundError("Reply draft not found");
  }

  // Update
  const persisted = await prisma.reviewReplyDraft.update({
    where: { id: draftId },
    data: {
      content: content.trim(),
      updatedAt: new Date(),
    },
  });

  log("info", "Reply draft updated", {
    tenantId,
    draftId,
    contentLength: content.length,
  });

  return {
    id: persisted.id,
    tenantId: persisted.tenantId,
    googleReviewId: persisted.googleReviewId,
    content: persisted.content,
    provider: persisted.provider,
    model: persisted.model,
    createdAt: persisted.createdAt,
    updatedAt: persisted.updatedAt,
  };
}

/**
 * Regenerate an AI reply draft for an existing GoogleReview.
 * Replaces the current draft (upsert). Leaves GoogleReview unchanged.
 */
export async function regenerateReplyDraft(
  tenantId: string,
  googleReviewId: string,
  aiProvider: AIProvider
): Promise<ReplyDraftResult> {
  // Load review scoped to tenant (verifies ownership)
  const review = await prisma.googleReview.findFirst({
    where: {
      id: googleReviewId,
      tenantId,
    },
  });

  if (!review) {
    throw new NotFoundError("Google review not found");
  }

  // Build minimal AI input
  const domainInput: ReplyDraftInput = {
    reviewerDisplayName: review.reviewerDisplayName ?? undefined,
    starRating: review.starRating ?? undefined,
    comment: review.comment ?? undefined,
    replyComment: review.replyComment ?? undefined,
  };

  // Invoke AI provider
  let output;
  try {
    output = await aiProvider.generateReplyDraft(domainInput);
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      throw error;
    }
    throw new ExternalServiceError("AIProvider", "AI reply draft generation failed", {
      cause: error instanceof Error ? error : undefined,
    });
  }

  // Validate AI result
  if (!output || typeof output.content !== "string") {
    throw new ExternalServiceError("AIProvider", "AI provider returned an invalid response");
  }

  const content = output.content.trim();

  if (content.length === 0) {
    throw new ExternalServiceError("AIProvider", "AI provider returned an empty reply draft");
  }
  if (content.length > 1000) {
    throw new ExternalServiceError(
      "AIProvider",
      "AI provider returned an overly long reply draft exceeding 1000 characters"
    );
  }

  // Replace current draft (upsert)
  const now = new Date();
  const persisted = await prisma.reviewReplyDraft.upsert({
    where: {
      tenantId_googleReviewId: {
        tenantId,
        googleReviewId,
      },
    },
    update: {
      content,
      updatedAt: now,
    },
    create: {
      tenantId,
      googleReviewId,
      content,
    },
  });

  log("info", "AI reply draft regenerated and persisted", {
    tenantId,
    googleReviewId,
    contentLength: content.length,
  });

  return {
    id: persisted.id,
    tenantId: persisted.tenantId,
    googleReviewId: persisted.googleReviewId,
    content: persisted.content,
    provider: persisted.provider,
    model: persisted.model,
    createdAt: persisted.createdAt,
    updatedAt: persisted.updatedAt,
  };
}

/**
 * Get an existing reply draft for a GoogleReview, scoped to tenant.
 */
export async function getReplyDraft(
  tenantId: string,
  googleReviewId: string
): Promise<ReplyDraftResult | null> {
  const draft = await prisma.reviewReplyDraft.findFirst({
    where: {
      tenantId,
      googleReviewId,
    },
  });

  if (!draft) return null;

  return {
    id: draft.id,
    tenantId: draft.tenantId,
    googleReviewId: draft.googleReviewId,
    content: draft.content,
    provider: draft.provider,
    model: draft.model,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}