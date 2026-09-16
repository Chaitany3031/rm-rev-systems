-- CreateTable
CREATE TABLE "GoogleConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "googleAccountId" TEXT,
    "googleAccountName" TEXT,
    "googleLocationId" TEXT,
    "googleLocationName" TEXT,
    "locationTitle" TEXT,
    "locationAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "errorMessage" TEXT,
    "scope" TEXT,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleConnection_tenantId_key" ON "GoogleConnection"("tenantId");

-- CreateIndex
CREATE INDEX "GoogleConnection_tenantId_status_idx" ON "GoogleConnection"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "GoogleConnection" ADD CONSTRAINT "GoogleConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
