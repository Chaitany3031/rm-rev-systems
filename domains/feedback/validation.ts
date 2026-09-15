import { z } from "zod";
import { FEEDBACK_MAX_LENGTH, MAX_RATING, MIN_RATING } from "./constants";

/**
 * Zod schema for validating raw feedback submission input.
 */
export const feedbackSubmissionSchema = z.object({
  publicToken: z
    .string()
    .trim()
    .min(1, "Public token is required"),

  rating: z
    .number()
    .int("Rating must be a whole number between 1 and 5")
    .min(MIN_RATING, `Rating must be at least ${MIN_RATING}`)
    .max(MAX_RATING, `Rating must be at most ${MAX_RATING}`),

  serviceIds: z
    .array(z.string().min(1, "Service ID cannot be empty"))
    .min(1, "Please select at least one service")
    .transform((ids) => Array.from(new Set(ids))), // Deduplicate IDs

  feedback: z
    .string()
    .max(
      FEEDBACK_MAX_LENGTH,
      `Feedback cannot exceed ${FEEDBACK_MAX_LENGTH} characters`
    )
    .optional()
    .nullable()
    .transform((val) => {
      if (val === null || val === undefined) return null;
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
});

export type ValidatedFeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>;
