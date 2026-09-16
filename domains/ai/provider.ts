import { getEnvConfig } from "@/lib/env";
import type { AIProvider, ReviewDraftInput, ReviewDraftOutput, ReplyDraftInput, ReplyDraftOutput } from "../reviews/types";
import { log } from "@/lib/errors";

function formatServicesList(serviceNames: string[]): string {
  if (!serviceNames || serviceNames.length === 0) return "their services";
  if (serviceNames.length === 1) return serviceNames[0];
  if (serviceNames.length === 2) return `${serviceNames[0]} and ${serviceNames[1]}`;
  return `${serviceNames.slice(0, -1).join(", ")}, and ${serviceNames[serviceNames.length - 1]}`;
}

/**
 * Deterministic review draft generator for development and testing.
 * Grounded strictly in the supplied ReviewDraftInput without hallucinating facts.
 *
 * Rules:
 * - Uses customer perspective ("I had...", "I used...")
 * - Uses supplied business name and service names
 * - Adjusts tone and sentiment to match the rating (1-5 stars)
 * - Incorporates customer written feedback if present
 * - Never hallucinates unprovided facts, names, dates, or prices
 * - Never returns a universal positive 5-star review for low ratings
 */
function buildDeterministicMockDraft(input: ReviewDraftInput): string {
  const { businessName, serviceNames, overallRating, customerFeedback } = input;
  const servicesText = formatServicesList(serviceNames);
  const trimmedFeedback = customerFeedback?.trim() ?? "";

  let baseReview = "";
  if (overallRating === 5) {
    baseReview = `I had an excellent experience with ${businessName} for ${servicesText}. Everything went smoothly and I am very satisfied with the results.`;
  } else if (overallRating === 4) {
    baseReview = `I had a positive experience working with ${businessName} on ${servicesText}. The team delivered solid results and met my expectations.`;
  } else if (overallRating === 3) {
    baseReview = `I used ${businessName} for ${servicesText}. The overall experience was satisfactory, though there were areas that could be improved.`;
  } else if (overallRating === 2) {
    baseReview = `I engaged ${businessName} for ${servicesText}, but the outcome did not meet my expectations and there were several issues.`;
  } else {
    baseReview = `I had a disappointing experience with ${businessName} regarding ${servicesText}. The service fell short of expectations.`;
  }

  if (trimmedFeedback.length > 0) {
    return `${baseReview} ${trimmedFeedback}`;
  }

  return baseReview;
}

/**
 * Deterministic mock reply draft generator for development and testing.
 * Grounded strictly in the supplied Google review data without hallucinating facts.
 *
 * Rules:
 * - Uses business perspective ("Thank you", "We appreciate")
 * - Uses supplied review data only: reviewer name, rating, comment, existing reply
 * - Never invents products, services, prices, employees, locations, timelines
 * - Adjusts tone to match the rating (1-5 stars)
 * - For positive reviews: simple genuine thank-you
 * - For negative reviews: acknowledge without arguing or inventing corrective actions
 * - For reviews without comments: remain generic and appropriate
 */
function buildDeterministicMockReply(reviewData: ReplyDraftInput): string {
  const { reviewerDisplayName, starRating, comment, replyComment } = reviewData;
  const reviewerName = reviewerDisplayName?.trim() ?? "the customer";
  const trimmedComment = comment?.trim() ?? "";
  const hasExistingReply = Boolean(replyComment?.trim());

  let baseReply = "";

  if (starRating !== undefined && starRating >= 5) {
    baseReply = `Thank you so much for your kind words, ${reviewerName}. We're thrilled you had a great experience!`;
  } else if (starRating !== undefined && starRating === 4) {
    baseReply = `Thank you for your positive feedback, ${reviewerName}. We're glad you enjoyed your experience with us!`;
  } else if (starRating !== undefined && starRating === 3) {
    baseReply = `Thank you for your feedback, ${reviewerName}. We appreciate you taking the time to share your thoughts, and we'll continue working to improve.`;
  } else if (starRating !== undefined && starRating === 2) {
    baseReply = `Thank you for sharing your feedback, ${reviewerName}. We appreciate your honest assessment and are committed to enhancing our service.`;
  } else if (starRating !== undefined && starRating === 1) {
    baseReply = `Thank you for bringing this to our attention, ${reviewerName}. We take all feedback seriously and are working to improve.`;
  } else {
    baseReply = `Thank you for your review, ${reviewerName}. We appreciate your feedback and are committed to providing a great experience.`;
  }

  if (trimmedComment.length > 0) {
    return `${baseReply} ${trimmedComment}`;
  }

  if (hasExistingReply) {
    return `${baseReply} We see you've had previous engagement with our team.`;
  }

  return baseReply;
}

class MockAIProvider implements AIProvider {
  async generateReviewDraft(input: ReviewDraftInput): Promise<ReviewDraftOutput> {
    // Simulate generation delay in non-test environments
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    log("info", "Mock AI provider executed", {
      provider: "mock",
      businessName: input.businessName,
      servicesCount: input.serviceNames.length,
      rating: input.overallRating,
      hasFeedback: Boolean(input.customerFeedback?.trim()),
    });

    const draft = buildDeterministicMockDraft(input);

    return {
      draft,
    };
  }

  async generateReplyDraft(input: ReplyDraftInput): Promise<ReplyDraftOutput> {
    // Simulate generation delay in non-test environments
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    log("info", "Mock AI provider executed for reply draft", {
      provider: "mock",
      hasReviewerName: Boolean(input.reviewerDisplayName?.trim()),
      rating: input.starRating,
      hasComment: Boolean(input.comment?.trim()),
      hasExistingReply: Boolean(input.replyComment?.trim()),
    });

    const content = buildDeterministicMockReply(input);

    return {
      content,
    };
  }
}

/**
 * Global provider resolution. Returns the configured provider.
 */
export function getAIProvider(): AIProvider {
  const config = getEnvConfig();
  switch (config.AI_PROVIDER) {
    case "mock":
      return new MockAIProvider();
    default:
      throw new Error(`Unsupported AI_PROVIDER: ${config.AI_PROVIDER}`);
  }
}

export { buildDeterministicMockDraft, buildDeterministicMockReply };