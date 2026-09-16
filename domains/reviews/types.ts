/**
 * Application-facing AI provider abstraction (Feature 03).
 *
 * The domain/application layer depends on this interface only — never on a
 * specific AI vendor SDK. Provider-specific code lives behind concrete
 * implementations of `AIProvider`, invoked through `getAIProvider()`.
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

export interface AIProvider {
  generateReviewDraft(input: ReviewDraftInput): Promise<ReviewDraftOutput>;
}

/** Persisted draft result returned to the caller. */
export interface ReviewDraftResult {
  submissionId: string;
  draft: string;
  updatedAt: Date;
}