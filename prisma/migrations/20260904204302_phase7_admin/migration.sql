-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "moderationNote" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "status" SET DEFAULT 'pending_review';

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "vendorOrderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "walletReversed" BOOLEAN NOT NULL DEFAULT false,
    "processedById" TEXT,
    "processedByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Refund_vendorOrderId_idx" ON "Refund"("vendorOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "CmsPage_slug_key" ON "CmsPage"("slug");

-- CreateIndex
CREATE INDEX "CmsPage_published_idx" ON "CmsPage"("published");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_vendorOrderId_fkey" FOREIGN KEY ("vendorOrderId") REFERENCES "VendorOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
