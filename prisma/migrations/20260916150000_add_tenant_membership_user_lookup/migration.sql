-- CreateIndex
CREATE INDEX "TenantMembership_userId_tenantId_idx" ON "TenantMembership"("userId", "tenantId");