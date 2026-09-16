-- CreateTable
CREATE TABLE "ReviewReplyDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "googleReviewId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewReplyDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewReplyDraft_tenantId_idx" ON "ReviewReplyDraft"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReplyDraft_tenantId_googleReviewId_key" ON "ReviewReplyDraft"("tenantId", "googleReviewId");

-- AddForeignKey
ALTER TABLE "ReviewReplyDraft" ADD CONSTRAINT "ReviewReplyDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReplyDraft" ADD CONSTRAINT "ReviewReplyDraft_googleReviewId_fkey" FOREIGN KEY ("googleReviewId") REFERENCES "GoogleReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
