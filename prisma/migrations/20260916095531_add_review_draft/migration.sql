-- CreateTable
CREATE TABLE "ReviewDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "feedbackSubmissionId" TEXT NOT NULL,
    "draft" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewDraft_tenantId_idx" ON "ReviewDraft"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewDraft_feedbackSubmissionId_key" ON "ReviewDraft"("feedbackSubmissionId");

-- AddForeignKey
ALTER TABLE "ReviewDraft" ADD CONSTRAINT "ReviewDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDraft" ADD CONSTRAINT "ReviewDraft_feedbackSubmissionId_fkey" FOREIGN KEY ("feedbackSubmissionId") REFERENCES "FeedbackSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
