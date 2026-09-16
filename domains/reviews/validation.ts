import { z } from "zod";

/**
 * Maximum length for a generated/editable review draft.
 * Review text is intentionally shorter than raw feedback; this bounds AI output
 * and prevents absurdly long drafts from being stored.
 */
export const DRAFT_MAX_LENGTH = 1000;

/**
 * Zod schema for the request identifiers used to generate a review draft.
 * Requires both the tenant's opaque public token and the submission id.
 * The server resolves the tenant from the public token and strictly verifies
 * that the feedback submission belongs to that tenant before generation.
 */
export const generateReviewDraftRequestSchema = z.object({
  publicToken: z.string().trim().min(1, "Public feedback token is required"),
  submissionId: z.string().trim().min(1, "Feedback submission identifier is required"),
});

export type GenerateReviewDraftRequest = z.infer<typeof generateReviewDraftRequestSchema>;

/**
 * Zod schema for validating the AI provider's raw output before persistence.
 * The draft must be a non-empty string within a reasonable length. Malformed or
 * empty provider responses are rejected rather than persisted.
 */
export const reviewDraftOutputSchema = z
  .string()
  .trim()
  .min(1, "Generated review draft cannot be empty")
  .max(
    DRAFT_MAX_LENGTH,
    `Generated review draft cannot exceed ${DRAFT_MAX_LENGTH} characters`
  );

/**
 * Validates the domain input (settled submission data) prepared by the service
 * before it is handed to the AI provider. Protects against malformed internal
 * input reaching the provider boundary.
 */
export const reviewDraftInputSchema = z.object({
  businessName: z.string().min(1),
  serviceNames: z.array(z.string().min(1)).min(1),
  overallRating: z.number().int().min(1).max(5),
  customerFeedback: z.string().max(DRAFT_MAX_LENGTH).optional().nullable(),
});