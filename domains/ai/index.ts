/**
 * AI domain — generation, provider routing, prompts, model metadata.
 *
 * Feature 03 introduces the provider-agnostic `AIProvider` abstraction. The
 * development mock provider returns a deterministic, grounded draft based on
 * real ReviewDraftInput so the full customer flow can be exercised without
 * an external AI service.
 */
export type { AIProvider, ReviewDraftInput, ReviewDraftOutput } from "../reviews/types";
export { REVIEW_DRAFT_SYSTEM_PROMPT } from "./prompts/review-draft";
export { getAIProvider, buildDeterministicMockDraft } from "./provider";
