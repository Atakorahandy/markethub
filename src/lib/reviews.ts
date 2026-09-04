import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

/** A product's/vendor's rating is always recomputed from published reviews
 *  — never incremented/averaged in place — so hiding a review (moderation)
 *  or adding one always leaves the cache exactly consistent with the table
 *  it's caching, matching the ledger-truth discipline used for wallets. */
export async function recomputeProductRating(tx: Tx, productId: string): Promise<void> {
  const agg = await tx.review.aggregate({ where: { productId, status: "published" }, _avg: { rating: true }, _count: { _all: true } });
  await tx.product.update({ where: { id: productId }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all } });
}

export async function recomputeVendorRating(tx: Tx, vendorId: string): Promise<void> {
  const agg = await tx.review.aggregate({ where: { vendorId, status: "published" }, _avg: { rating: true }, _count: { _all: true } });
  await tx.vendor.update({ where: { id: vendorId }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all } });
}
