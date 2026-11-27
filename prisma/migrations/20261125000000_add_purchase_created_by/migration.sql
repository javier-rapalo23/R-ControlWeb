-- AlterTable
ALTER TABLE "PurchaseTransaction" ADD COLUMN "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX "PurchaseTransaction_createdByUserId_idx" ON "PurchaseTransaction"("createdByUserId");
