import { prisma } from "./prisma";
import { activeFlashSalesByProduct, effectiveUnitPrice } from "./pricing";

/** Loads a user's cart with live product/vendor data joined, and computes
 *  per-vendor + grand totals server-side. Never trust a client-supplied
 *  price or total — this is the one place cart math happens, reused by both
 *  the cart display endpoint and checkout. */
export async function loadCartSummary(userId: string) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        include: { vendor: { select: { id: true, businessName: true, slug: true, status: true, baseDeliveryFee: true } } },
      },
    },
  });

  const variantIds = items.map((i) => i.variantId).filter((v): v is string => !!v);
  const variants = variantIds.length
    ? await prisma.productVariant.findMany({ where: { id: { in: variantIds } } })
    : [];
  const variantById = new Map(variants.map((v) => [v.id, v]));
  const flashSaleByProduct = await activeFlashSalesByProduct(prisma, items.map((i) => i.productId));

  const lines = items.map((item) => {
    const variant = item.variantId ? variantById.get(item.variantId) ?? null : null;
    const unavailable =
      item.product.status !== "active" ||
      item.product.vendor.status !== "approved" ||
      (variant ? variant.stock <= 0 : item.product.stock <= 0);
    const basePrice = variant?.priceOverride ?? item.product.discountPrice ?? item.product.price;
    const flashSalePrice = flashSaleByProduct.get(item.productId) ?? null;
    const unitPrice = effectiveUnitPrice(basePrice, flashSalePrice);
    const availableStock = variant ? variant.stock : item.product.stock;
    const quantity = Math.min(item.quantity, Math.max(availableStock, 0)) || item.quantity;
    return {
      id: item.id,
      productId: item.product.id,
      productSlug: item.product.slug,
      productName: item.product.name,
      image: JSON.parse(item.product.images || "[]")[0] ?? null,
      variantId: variant?.id ?? null,
      variantLabel: variant?.label ?? null,
      unitPrice,
      onFlashSale: unitPrice === flashSalePrice && flashSalePrice != null && flashSalePrice < basePrice,
      quantity: item.quantity,
      availableStock,
      unavailable,
      exceedsStock: item.quantity > availableStock,
      lineTotal: unitPrice * item.quantity,
      vendor: item.product.vendor,
    };
  });

  const vendorMap = new Map<string, { vendorId: string; vendorName: string; deliveryFee: number; subtotal: number; lines: typeof lines }>();
  for (const line of lines) {
    if (line.unavailable || line.exceedsStock) continue;
    const key = line.vendor.id;
    if (!vendorMap.has(key)) {
      vendorMap.set(key, { vendorId: key, vendorName: line.vendor.businessName, deliveryFee: line.vendor.baseDeliveryFee, subtotal: 0, lines: [] });
    }
    const group = vendorMap.get(key)!;
    group.subtotal += line.lineTotal;
    group.lines.push(line);
  }

  const vendorGroups = [...vendorMap.values()];
  const subtotal = vendorGroups.reduce((sum, g) => sum + g.subtotal, 0);
  const deliveryFee = vendorGroups.reduce((sum, g) => sum + g.deliveryFee, 0);
  const total = subtotal + deliveryFee;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const readyToCheckout = lines.length > 0 && lines.every((l) => !l.unavailable && !l.exceedsStock);

  return { lines, vendorGroups, subtotal, deliveryFee, total, itemCount, readyToCheckout };
}
