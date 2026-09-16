"use server";

import { requireTenantAdmin } from "@/domains/auth";
import { syncGoogleReviews, getTenantReviews } from "@/domains/google/reviews";
import { ValidationError, NotFoundError, AuthorizationError, log } from "@/lib/errors";
import type { ReviewSyncResult } from "@/domains/google/types";
import type { GoogleReview } from "@prisma/client";

export type ActionResult<T> =
  | { success: true; data: T; errors?: never; message?: never }
  | { success: false; data?: never; errors: Record<string, string[]>; message?: string };

/**
 * Server action: Trigger manual sync of Google reviews for a tenant.
 * Validates authentication and authorization before syncing reviews.
 */
export async function triggerReviewSync(tenantId: string): Promise<ActionResult<ReviewSyncResult>> {
  try {
    // 1. Authorize: validate tenantId, reject public tokens, verify tenant exists
    const admin = await requireTenantAdmin(tenantId);

    // 2. Use the authorized tenant ID from the validated session
    const result = await syncGoogleReviews({ tenantId: admin.tenantId });
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: error.message,
      };
    }

    if (error instanceof ValidationError) {
      return {
        success: false,
        errors: error.details ?? { form: [error.message] },
        message: error.message,
      };
    }

    if (error instanceof NotFoundError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: error.message,
      };
    }

    log("error", "Error in triggerReviewSync", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      errors: {
        form: ["An unexpected error occurred while syncing reviews. Please try again."],
      },
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Server action: Fetch paginated reviews for a tenant's inbox.
 * Validates authentication and authorization before fetching reviews.
 */
export async function fetchTenantReviews(params: {
  tenantId: string;
  limit?: number;
  offset?: number;
}): Promise<
  ActionResult<{
    reviews: GoogleReview[];
    total: number;
    limit: number;
    offset: number;
  }>
> {
  try {
    // 1. Authorize: validate tenantId, reject public tokens, verify tenant exists
    const admin = await requireTenantAdmin(params.tenantId);

    // 2. Use the authorized tenant ID from the validated session
    const result = await getTenantReviews({
      tenantId: admin.tenantId,
      limit: params.limit,
      offset: params.offset,
    });
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: error.message,
      };
    }

    if (error instanceof ValidationError) {
      return {
        success: false,
        errors: error.details ?? { form: [error.message] },
        message: error.message,
      };
    }

    if (error instanceof NotFoundError) {
      return {
        success: false,
        errors: { form: [error.message] },
        message: error.message,
      };
    }

    log("error", "Error in fetchTenantReviews", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      errors: {
        form: ["An unexpected error occurred while fetching reviews. Please try again."],
      },
      message: "An unexpected error occurred. Please try again.",
    };
  }
}
