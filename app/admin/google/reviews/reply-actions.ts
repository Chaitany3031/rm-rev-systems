"use server";

import { requireTenantAdmin } from "@/domains/auth";
import { getAIProvider } from "@/domains/ai";
import {
  generateReplyDraft,
  updateReplyDraft,
  regenerateReplyDraft,
  getReplyDraft,
} from "@/domains/reviews";
import {
  ValidationError,
  NotFoundError,
  ExternalServiceError,
  AuthorizationError,
  log,
} from "@/lib/errors";

export type ReplyDraftActionState =
  | { success: true; data: { id: string; content: string; googleReviewId: string }; errors?: never; message?: never }
  | { success: false; data?: never; errors: Record<string, string[]>; message?: string };

export type ReplyDraftRegenerateState =
  | { success: true; data: { id: string; content: string; googleReviewId: string }; errors?: never; message?: never }
  | { success: false; data?: never; errors: Record<string, string[]>; message?: string };

/**
 * Server Action: Generate an AI reply draft for a Google review.
 * Authenticated tenant admin only. Tenant resolved from authenticated session.
 */
export async function generateReplyDraftAction(
  tenantId: string,
  googleReviewId: string
): Promise<ReplyDraftActionState> {
  try {
    // 1. Authenticate admin and resolve tenant from session
    const admin = await requireTenantAdmin(tenantId);

    // 2. Generate draft using the authenticated tenantId (never browser-supplied)
    const provider = getAIProvider();
    const result = await generateReplyDraft(admin.tenantId, googleReviewId, provider);

    return {
      success: true,
      data: {
        id: result.id,
        content: result.content,
        googleReviewId: result.googleReviewId,
      },
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: error.message,
      };
    }

    if (error instanceof ValidationError) {
      return {
        success: false,
        errors: error.details ?? { form: [error.message] },
        message: error.message,
      };
    }

    if (error instanceof NotFoundError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: error.message,
      };
    }

    if (error instanceof ExternalServiceError) {
      log("warn", "AI provider failure during reply draft generation", {
        service: error.service,
        error: error.message,
      });
      return {
        success: false,
        errors: {
          form: [
            "We were unable to generate an AI reply draft right now. You can retry.",
          ],
        },
        message: "AI reply draft generation temporarily unavailable.",
      };
    }

    log("error", "Unhandled error in generateReplyDraftAction", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      errors: {
        form: ["An unexpected error occurred while generating the reply draft. Please try again."],
      },
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Server Action: Edit an existing AI reply draft.
 * Authenticated tenant admin only. Draft ownership verified.
 */
export async function editReplyDraftAction(
  tenantId: string,
  draftId: string,
  content: string
): Promise<ReplyDraftActionState> {
  try {
    // 1. Authenticate admin using tenant identifier (not draft ID)
    const admin = await requireTenantAdmin(tenantId);

    // 2. Update draft (tenant isolation enforced in domain service)
    const result = await updateReplyDraft(admin.tenantId, draftId, content);

    return {
      success: true,
      data: {
        id: result.id,
        content: result.content,
        googleReviewId: result.googleReviewId,
      },
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: error.message,
      };
    }

    if (error instanceof ValidationError) {
      return {
        success: false,
        errors: error.details ?? { form: [error.message] },
        message: error.message,
      };
    }

    if (error instanceof NotFoundError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: error.message,
      };
    }

    log("error", "Unhandled error in editReplyDraftAction", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      errors: {
        form: ["An unexpected error occurred while saving the reply draft. Please try again."],
      },
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Server Action: Regenerate an AI reply draft for a Google review.
 * Authenticated tenant admin only. Replaces current draft. Leaves GoogleReview unchanged.
 */
export async function regenerateReplyDraftAction(
  tenantId: string,
  googleReviewId: string
): Promise<ReplyDraftRegenerateState> {
  try {
    // 1. Authenticate admin and resolve tenant from session
    const admin = await requireTenantAdmin(tenantId);

    // 2. Regenerate draft (tenant isolation enforced in domain service)
    const provider = getAIProvider();
    const result = await regenerateReplyDraft(admin.tenantId, googleReviewId, provider);

    return {
      success: true,
      data: {
        id: result.id,
        content: result.content,
        googleReviewId: result.googleReviewId,
      },
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: error.message,
      };
    }

    if (error instanceof NotFoundError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: error.message,
      };
    }

    if (error instanceof ExternalServiceError) {
      log("warn", "AI provider failure during reply draft regeneration", {
        service: error.service,
        error: error.message,
      });
      return {
        success: false,
        errors: {
          form: [
            "We were unable to regenerate the AI reply draft right now. You can retry.",
          ],
        },
        message: "AI reply draft regeneration temporarily unavailable.",
      };
    }

    log("error", "Unhandled error in regenerateReplyDraftAction", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      errors: {
        form: ["An unexpected error occurred while regenerating the reply draft. Please try again."],
      },
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Server Action: Fetch an existing reply draft for a Google review.
 */
export async function fetchReplyDraftAction(
  tenantId: string,
  googleReviewId: string
): Promise<ReplyDraftActionState> {
  try {
    // Authenticate admin and resolve tenant from session
    const admin = await requireTenantAdmin(tenantId);

    // Get draft scoped to the authenticated tenant
    const draft = await getReplyDraft(admin.tenantId, googleReviewId);

    if (!draft) {
      return {
        success: false,
        errors: { form: ["No reply draft found for this review"] },
        message: "No reply draft found",
      };
    }

    return {
      success: true,
      data: {
        id: draft.id,
        content: draft.content,
        googleReviewId: draft.googleReviewId,
      },
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: error.message,
      };
    }

    if (error instanceof NotFoundError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: error.message,
      };
    }

    log("error", "Unhandled error in fetchReplyDraftAction", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      errors: {
        form: ["An unexpected error occurred while fetching the reply draft. Please try again."],
      },
      message: "An unexpected error occurred. Please try again.",
    };
  }
}
