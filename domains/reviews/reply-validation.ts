import { z } from "zod";
import type { ReplyDraftInput, ReplyDraftOutput } from "./types";

/**
 * Maximum length for an AI reply draft content.
 * Shared with the review draft feature (DRAFT_MAX_LENGTH = 1000).
 */
export const REPLY_DRAFT_MAX_LENGTH = 1000;

/**
 * Zod schema for generating a reply draft request.
 * Requires the authenticated tenantId and the googleReviewId.
 * The server resolves the tenant from the authenticated session
 * (not from this input) and strictly verifies ownership.
 */
export const generateReplyDraftRequestSchema = z.object({
  googleReviewId: z.string().trim().min(1, "Google review identifier is required"),
});

export type GenerateReplyDraftRequest = z.infer<typeof generateReplyDraftRequestSchema>;

/**
 * Zod schema for validating AI provider output for reply drafts.
 */
export const replyDraftOutputSchema = z
  .string()
  .trim()
  .min(1, "Reply draft cannot be empty")
  .max(
    REPLY_DRAFT_MAX_LENGTH,
    `Reply draft cannot exceed ${REPLY_DRAFT_MAX_LENGTH} characters`
  );

export type ReplyDraftOutputSchema = z.infer<typeof replyDraftOutputSchema>;

/**
 * Zod schema for editing a reply draft.
 */
export const updateReplyDraftSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Reply draft content cannot be empty")
    .max(REPLY_DRAFT_MAX_LENGTH, `Reply draft cannot exceed ${REPLY_DRAFT_MAX_LENGTH} characters`),
});

export type UpdateReplyDraftInput = z.infer<typeof updateReplyDraftSchema>;

/** Server-action input for approving a tenant-scoped reply draft. */
export const approveReplyDraftRequestSchema = z.object({
  tenantId: z.string().trim().min(1, "Tenant identifier is required"),
  draftId: z.string().trim().min(1, "Reply draft identifier is required"),
});

export type ApproveReplyDraftRequest = z.infer<typeof approveReplyDraftRequestSchema>;

/**
 * Schema for the minimal review data sent to the AI provider.
 * Only safe, non-sensitive fields from GoogleReview are included.
 */
export const replyDraftInputSchema = z.object({
  reviewerDisplayName: z.string().optional(),
  starRating: z.number().int().min(1).max(5).optional(),
  comment: z.string().optional(),
  replyComment: z.string().nullable().optional(),
});

export { type ReplyDraftInput, type ReplyDraftOutput };