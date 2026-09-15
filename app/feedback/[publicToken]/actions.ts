"use server";

import { submitFeedback } from "@/domains/feedback";
import type { FeedbackActionState, SubmitFeedbackInput } from "@/domains/feedback";
import { ValidationError, NotFoundError, log } from "@/lib/errors";

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
