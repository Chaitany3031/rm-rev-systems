/**
 * Application-facing AI provider abstraction (Feature 03 + Feature 06).
 *
 * The domain/application layer depends on this interface only — never on a
 * specific AI vendor SDK. Provider-specific code lives behind concrete
 * implementations of `AIProvider`, invoked through `getAIProvider()`.
 *
 * Feature 06 extends the interface with `generateReplyDraft` for
 * AI-assisted Google review reply drafting.
 */
export interface ReviewDraftInput {
  businessName: string;
  serviceNames: string[];
  overallRating: number;
  customerFeedback?: string | null;
}

export interface ReviewDraftOutput {
  draft: string;
}

/**
 * Minimal review data for AI-assisted reply drafting.
 * Only safe, non-sensitive GoogleReview fields are included.
 */
export interface ReplyDraftInput {
  reviewerDisplayName?: string;
  starRating?: number;
  comment?: string;
  replyComment?: string;
}

export interface ReplyDraftOutput {
  content: string;
}

export interface AIProvider {
  generateReviewDraft(input: ReviewDraftInput): Promise<ReviewDraftOutput>;
  generateReplyDraft(input: ReplyDraftInput): Promise<ReplyDraftOutput>;
}

/** Persisted review draft result returned to the caller. */
export interface ReviewDraftResult {
  submissionId: string;
  draft: string;
  updatedAt: Date;
}