-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "stockDeductedAt" TIMESTAMP(3),
ADD COLUMN     "stockReservedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "orderSeq" INTEGER NOT NULL DEFAULT 0;
