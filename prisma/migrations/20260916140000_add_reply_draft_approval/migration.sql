-- AlterTable
ALTER TABLE "ReviewReplyDraft"
ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvedById" TEXT;

-- AddForeignKey
ALTER TABLE "ReviewReplyDraft" ADD CONSTRAINT "ReviewReplyDraft_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ReviewReplyDraft_tenantId_approved_idx" ON "ReviewReplyDraft"("tenantId", "approved");
