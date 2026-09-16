/**
 * Reviews domain — review drafts and reply drafts.
 *
 * Feature 03 adds a persisted, editable, AI-generated review draft per feedback
 * submission. The draft and the original `FeedbackSubmission.feedback` are
 * separate concepts and never overwrite each other.
 *
 * Feature 06 adds AI-assisted reply drafts for Google reviews.
 * A single current draft per (tenant, googleReview) pair.
 * The draft is separate from GoogleReview.replyComment and must never be published by Feature 06.
 */
export * from "./validation";
export * from "./service";
export * from "./types";
export * from "./reply-validation";
export {
  generateReplyDraft,
  updateReplyDraft,
  regenerateReplyDraft,
  getReplyDraft,
} from "./reply-service";
export type { ReplyDraftResult } from "./reply-service";