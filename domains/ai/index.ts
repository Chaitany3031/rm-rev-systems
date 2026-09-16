/**
 * AI domain — generation, provider routing, prompts, model metadata.
 *
 * Feature 03 introduces the provider-agnostic `AIProvider` abstraction. The
 * development mock provider returns a deterministic, grounded draft based on
 * real ReviewDraftInput so the full customer flow can be exercised without
 * an external AI service.
 *
 * Feature 06 extends the provider with `generateReplyDraft` for
 * AI-assisted Google review reply drafting.
 */
export type { AIProvider, ReviewDraftInput, ReviewDraftOutput, ReplyDraftInput, ReplyDraftOutput } from "../reviews/types";
export { REVIEW_DRAFT_SYSTEM_PROMPT } from "./prompts/review-draft";
export { REVIEW_REPLY_SYSTEM_PROMPT } from "./prompts/review-reply";
export { getAIProvider, buildDeterministicMockDraft, buildDeterministicMockReply } from "./provider";