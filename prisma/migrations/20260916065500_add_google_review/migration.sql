-- CreateTable
CREATE TABLE "GoogleReview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "googleConnectionId" TEXT NOT NULL,
    "googleReviewName" TEXT NOT NULL,
    "googleLocationName" TEXT NOT NULL,
    "reviewerDisplayName" TEXT,
    "starRating" INTEGER,
    "comment" TEXT,
    "reviewCreateTime" TIMESTAMP(3),
    "reviewUpdateTime" TIMESTAMP(3),
    "replyComment" TEXT,
    "replyUpdateTime" TIMESTAMP(3),
    "reviewReplyUrl" TEXT,
    "replyState" TEXT,
    "policyViolationCode" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleReview_tenantId_googleReviewName_key" ON "GoogleReview"("tenantId", "googleReviewName");

-- CreateIndex
CREATE INDEX "GoogleReview_tenantId_googleConnectionId_reviewUpdateTime_idx" ON "GoogleReview"("tenantId", "googleConnectionId", "reviewUpdateTime");

-- AddForeignKey
ALTER TABLE "GoogleReview" ADD CONSTRAINT "GoogleReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleReview" ADD CONSTRAINT "GoogleReview_googleConnectionId_fkey" FOREIGN KEY ("googleConnectionId") REFERENCES "GoogleConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
