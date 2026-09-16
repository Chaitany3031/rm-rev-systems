"use server";

import { submitFeedback } from "@/domains/feedback";
import type { FeedbackActionState, SubmitFeedbackInput } from "@/domains/feedback";
import { generateReviewDraft, type ReviewDraftResult } from "@/domains/reviews";
import { getAIProvider } from "@/domains/ai";
import { ValidationError, NotFoundError, ExternalServiceError, log } from "@/lib/errors";

export type ReviewDraftActionState =
  | { success: true; data: ReviewDraftResult; errors?: never; message?: never }
  | { success: false; data?: never; errors: Record<string, string[]>; message?: string };

/**
 * Server Action for handling customer feedback submissions.
 */
export async function submitFeedbackAction(
  input: SubmitFeedbackInput
): Promise<FeedbackActionState> {
  try {
    const result = await submitFeedback(input);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
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
        errors: {
          form: ["The business feedback link is invalid or no longer active."],
        },
        message: error.message,
      };
    }

    // Unexpected error - log safely and return generic error message
    log("error", "Unhandled error in submitFeedbackAction", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      errors: {
        form: [
          "An unexpected error occurred while submitting your feedback. Please try again.",
        ],
      },
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Server Action for generating an AI review draft from a persisted submission.
 */
export async function generateReviewDraftAction(
  submissionId: string
): Promise<ReviewDraftActionState> {
  try {
    const provider = getAIProvider();
    const result = await generateReviewDraft({ submissionId }, provider);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
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
        errors: {
          form: ["Feedback submission could not be found."],
        },
        message: error.message,
      };
    }

    if (error instanceof ExternalServiceError) {
      log("warn", "AI provider failure during review draft generation", {
        service: error.service,
        error: error.message,
      });
      return {
        success: false,
        errors: {
          form: [
            "We were unable to generate an AI review draft right now. You can retry or write your own review.",
          ],
        },
        message: "AI review draft generation temporarily unavailable.",
      };
    }

    log("error", "Unhandled error in generateReviewDraftAction", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      errors: {
        form: [
          "An unexpected error occurred while generating your review draft. Please try again.",
        ],
      },
      message: "An unexpected error occurred. Please try again.",
    };
  }
}
