import type { Prisma, PrismaClient } from "@prisma/client";
import { Errors } from "./api";
import { applyBps, formatMoney } from "./money";

type Tx = Prisma.TransactionClient | PrismaClient;

/** Validates a coupon code against one vendor's slice of a basket and
 *  returns the discount to apply. Never trusts a client-supplied discount —
 *  this is the one place coupon math happens, shared by checkout and the
 *  cart-page preview endpoint.
 *
 *  Coupons are vendor-scoped only (`@@unique([vendorId, code])`), so a
 *  bare code string a customer types in is looked up only among the
 *  vendors actually present in their cart. Two different vendors could in
 *  principle pick the identical code text — an edge case left unresolved
 *  (the first match wins) rather than adding a vendor picker to checkout
 *  for a near-zero-probability collision. */
export async function findCartCoupon(tx: Tx, code: string, cartVendorIds: string[]) {
  const coupon = await tx.coupon.findFirst({
    where: { code: code.trim().toUpperCase(), vendorId: { in: cartVendorIds }, active: true },
  });
  if (!coupon) throw Errors.validation({ couponCode: "invalid" }, "That coupon code isn't valid for any store in your cart.");
  return coupon;
}

export async function checkCouponUsage(
  tx: Tx,
  coupon: { id: string; startsAt: Date | null; endsAt: Date | null; minSubtotal: number; usageLimit: number | null; perCustomerLimit: number | null },
  opts: { vendorSubtotal: number; customerId: string },
): Promise<void> {
  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) throw Errors.validation({ couponCode: "not_started" }, "This coupon isn't active yet.");
  if (coupon.endsAt && now > coupon.endsAt) throw Errors.validation({ couponCode: "expired" }, "This coupon has expired.");
  if (opts.vendorSubtotal < coupon.minSubtotal) {
    throw Errors.validation({ couponCode: "min_not_met" }, `Spend at least ${formatMoney(coupon.minSubtotal)} at this store to use this coupon.`);
  }
  if (coupon.usageLimit != null) {
    const used = await tx.vendorOrder.count({ where: { couponId: coupon.id, status: { not: "cancelled" } } });
    if (used >= coupon.usageLimit) throw Errors.validation({ couponCode: "exhausted" }, "This coupon has reached its usage limit.");
  }
  if (coupon.perCustomerLimit != null) {
    const usedByCustomer = await tx.vendorOrder.count({
      where: { couponId: coupon.id, status: { not: "cancelled" }, order: { customerId: opts.customerId } },
    });
    if (usedByCustomer >= coupon.perCustomerLimit) throw Errors.validation({ couponCode: "already_used" }, "You've already used this coupon.");
  }
}

export function computeDiscount(coupon: { type: string; value: number; maxDiscount: number | null }, vendorSubtotal: number): number {
  let discount = coupon.type === "percent" ? applyBps(vendorSubtotal, coupon.value * 100) : coupon.value;
  if (coupon.type === "percent" && coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
  return Math.min(discount, vendorSubtotal); // a coupon can never make a basket negative
}
