/**
 * AI domain — generation, provider routing, prompts, model metadata.
 *
 * Feature 03 introduces the provider-agnostic `AIProvider` abstraction. The
 * development mock provider returns a safe static draft configured via
 * environment variables so the full customer flow can be exercised without
 * an external AI service.
 */
export type { AIProvider, ReviewDraftInput, ReviewDraftOutput } from "../reviews/types";
export { REVIEW_DRAFT_SYSTEM_PROMPT } from "./prompts/review-draft";
export { getAIProvider } from "./provider";