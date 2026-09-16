import { prisma } from "@/lib/db";
import { safeParse } from "@/lib/validation";
import { NotFoundError, ValidationError, log } from "@/lib/errors";
import { getGoogleProvider, decryptToken, GoogleConnectionNotFoundError } from "../index";
import { syncReviewsSchema, getReviewsSchema } from "./validation";
import type { GoogleBusinessProfileProvider, ReviewSyncResult } from "../types";
import type { GoogleReview } from "@prisma/client";

/**
 * Synchronizes Google reviews for a tenant's connected Google Business Profile location.
 * Fetches reviews via paginated Google API, normalizes them, and upserts into PostgreSQL.
 * Idempotent: repeated calls safely update existing reviews without duplicating.
 * Partial failures are explicit: successfully synced reviews remain persisted.
 */
export async function syncGoogleReviews(
  input: unknown,
  provider: GoogleBusinessProfileProvider = getGoogleProvider()
): Promise<ReviewSyncResult> {
  const parseResult = safeParse(syncReviewsSchema, input);
  if (!parseResult.success) {
    throw new ValidationError("Invalid sync reviews input", parseResult.errors);
  }

  const { tenantId } = parseResult.data;

  // 1. Verify tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });

  if (!tenant) {
    throw new NotFoundError(`Tenant with id "${tenantId}" not found`);
  }

  // 2. Load tenant's Google connection
  const connection = await prisma.googleConnection.findUnique({
    where: { tenantId: tenant.id },
  });

  if (!connection) {
    throw new GoogleConnectionNotFoundError(
      `No Google connection found for tenant "${tenantId}". Please connect first.`
    );
  }

  if (connection.status !== "CONNECTED") {
    throw new ValidationError(`Google connection is not in CONNECTED status (current: ${connection.status})`);
  }

  // 3. Verify location is selected
  if (!connection.googleLocationName) {
    throw new ValidationError("No Google Business Profile location selected. Please select a location first.");
  }

  // 4. Obtain valid access token
  if (!connection.encryptedAccessToken) {
    throw new ValidationError("No access token available. Please reconnect your Google Business Profile.");
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(connection.encryptedAccessToken);
  } catch {
    throw new ValidationError("Failed to decrypt access token");
  }

  // 5. Fetch reviews paginated, upsert into database
  let processed = 0;
  let created = 0;
  let updated = 0;
  let completed = false;
  let pageToken: string | undefined;
  let syncError: string | undefined;

  try {
    // Loop through all pages
    while (true) {
      if (!provider.listReviews) {
        throw new Error("Provider does not support listReviews");
      }

      const pageResult = await provider.listReviews({
        accessToken,
        locationName: connection.googleLocationName,
        pageToken,
      });

      // Process each review on this page
      for (const reviewData of pageResult.reviews) {
        processed++;

        try {
          // Upsert: find existing by (tenantId + googleReviewName), update or create
          const existing = await prisma.googleReview.findUnique({
            where: {
              tenantId_googleReviewName: {
                tenantId: tenant.id,
                googleReviewName: reviewData.googleReviewName,
              },
            },
            select: { id: true },
          });

          if (existing) {
            // Update existing review
            await prisma.googleReview.update({
              where: { id: existing.id },
              data: {
                googleLocationName: reviewData.googleLocationName,
                reviewerDisplayName: reviewData.reviewerDisplayName || null,
                starRating: reviewData.starRating || null,
                comment: reviewData.comment || null,
                reviewCreateTime: reviewData.reviewCreateTime || null,
                reviewUpdateTime: reviewData.reviewUpdateTime || null,
                replyComment: reviewData.replyComment || null,
                replyUpdateTime: reviewData.replyUpdateTime || null,
                reviewReplyUrl: reviewData.reviewReplyUrl || null,
                replyState: reviewData.replyState || null,
                policyViolationCode: reviewData.policyViolationCode || null,
                syncedAt: new Date(),
                updatedAt: new Date(),
              },
            });
            updated++;
          } else {
            // Create new review
            await prisma.googleReview.create({
              data: {
                tenantId: tenant.id,
                googleConnectionId: connection.id,
                googleReviewName: reviewData.googleReviewName,
                googleLocationName: reviewData.googleLocationName,
                reviewerDisplayName: reviewData.reviewerDisplayName || null,
                starRating: reviewData.starRating || null,
                comment: reviewData.comment || null,
                reviewCreateTime: reviewData.reviewCreateTime || null,
                reviewUpdateTime: reviewData.reviewUpdateTime || null,
                replyComment: reviewData.replyComment || null,
                replyUpdateTime: reviewData.replyUpdateTime || null,
                reviewReplyUrl: reviewData.reviewReplyUrl || null,
                replyState: reviewData.replyState || null,
                policyViolationCode: reviewData.policyViolationCode || null,
                syncedAt: new Date(),
              },
            });
            created++;
          }
        } catch (err) {
          log("error", "Failed to upsert review", {
            googleReviewName: reviewData.googleReviewName,
            errorMessage: err instanceof Error ? err.message : "Unknown error",
          });
          // Continue syncing remaining reviews on this page
        }
      }

      // Check if there are more pages
      if (!pageResult.nextPageToken) {
        completed = true;
        break;
      }

      pageToken = pageResult.nextPageToken;
    }
  } catch (err) {
    syncError = err instanceof Error ? err.message : "Unknown error during sync";
    log("error", "Google review sync failed", {
      tenantId: tenant.id,
      errorMessage: syncError,
    });
  }

  log("info", "Google review sync completed", {
    tenantId: tenant.id,
    processed,
    created,
    updated,
    completed,
  });

  return {
    processed,
    created,
    updated,
    completed,
    error: syncError,
  };
}

/**
 * Retrieves paginated reviews for a tenant, ordered by reviewUpdateTime desc.
 */
export async function getTenantReviews(
  input: unknown
): Promise<{
  reviews: GoogleReview[];
  total: number;
  limit: number;
  offset: number;
}> {
  const parseResult = safeParse(getReviewsSchema, input);
  if (!parseResult.success) {
    throw new ValidationError("Invalid get reviews input", parseResult.errors);
  }

  const { tenantId, limit = 50, offset = 0 } = parseResult.data;

  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });

  if (!tenant) {
    throw new NotFoundError(`Tenant with id "${tenantId}" not found`);
  }

  // Fetch paginated reviews
  const [reviews, total] = await Promise.all([
    prisma.googleReview.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ reviewUpdateTime: "desc" }, { reviewCreateTime: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.googleReview.count({
      where: { tenantId: tenant.id },
    }),
  ]);

  return {
    reviews,
    total,
    limit,
    offset,
  };
}

/**
 * Retrieves a single review by ID, with tenant ownership verification.
 */
export async function getReviewById(tenantId: string, reviewId: string): Promise<GoogleReview | null> {
  if (!tenantId || !reviewId) {
    return null;
  }

  const review = await prisma.googleReview.findUnique({
    where: { id: reviewId },
  });

  if (!review || review.tenantId !== tenantId) {
    return null;
  }

  return review;
}
