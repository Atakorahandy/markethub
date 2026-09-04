import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

/** Batch-fetches the cheapest currently-active flash sale price per product
 *  id. The single place flash-sale pricing is read from — cart, checkout,
 *  and the product page all go through this instead of querying FlashSale
 *  ad hoc, so "currently active" always means the same thing everywhere. */
export async function activeFlashSalesByProduct(
  tx: Tx,
  productIds: string[],
  now: Date = new Date(),
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const sales = await tx.flashSale.findMany({
    where: { productId: { in: [...new Set(productIds)] }, active: true, startsAt: { lte: now }, endsAt: { gte: now } },
  });
  const map = new Map<string, number>();
  for (const s of sales) {
    const cur = map.get(s.productId);
    if (cur === undefined || s.salePrice < cur) map.set(s.productId, s.salePrice);
  }
  return map;
}

/** A flash sale can only ever lower what a customer pays, never raise it —
 *  if a vendor's own discountPrice is already cheaper than the flash sale
 *  (e.g. edited after the sale was scheduled), the customer gets whichever
 *  is lower. */
export function effectiveUnitPrice(basePrice: number, flashSalePrice: number | undefined | null): number {
  return flashSalePrice != null ? Math.min(basePrice, flashSalePrice) : basePrice;
}
