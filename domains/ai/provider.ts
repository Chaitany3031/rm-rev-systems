import { getEnvConfig } from "@/lib/env";
import type { AIProvider, ReviewDraftInput, ReviewDraftOutput } from "../reviews/types";
import { log } from "@/lib/errors";

class MockAIProvider implements AIProvider {
  async generateReviewDraft(input: ReviewDraftInput): Promise<ReviewDraftOutput> {
    const config = getEnvConfig();
    
    // Simulate generation delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    log("info", "Mock AI provider executed", {
      provider: "mock",
      businessName: input.businessName,
      servicesCount: input.serviceNames.length,
    });

    return {
      draft: config.AI_MOCK_DRAFT,
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