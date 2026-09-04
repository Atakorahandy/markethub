export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { loadCartSummary } from "@/lib/cart";
import { findCartCoupon, checkCouponUsage, computeDiscount } from "@/lib/coupons";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({ code: z.string().trim().min(1).max(30) });

/** Preview-only — checkout re-validates and applies the coupon itself, so
 *  this can never be trusted as the source of truth for the discount that
 *  actually lands on the order. It exists purely so the cart page can show
 *  "Coupon applied: -GHS X" before the customer commits to checkout.
 *
 *  Rate-limited: a coupon code (3-20 alphanumeric chars, vendor-chosen) has
 *  far less entropy than a password or reset token — without a limit here
 *  this endpoint would let anyone enumerate a vendor's live promo codes. */
export const POST = handler(async (req: Request) => {
  const s = await requireAuth(req);
  rateLimit(`coupon-preview:${s.userId}`, 20, 300);
  const body = await parseBody(req, schema);

  const cart = await loadCartSummary(s.userId);
  if (cart.vendorGroups.length === 0) throw Errors.validation({ cart: "Your cart is empty." });

  const vendorIds = cart.vendorGroups.map((g) => g.vendorId);
  const coupon = await findCartCoupon(prisma, body.code, vendorIds);
  const group = cart.vendorGroups.find((g) => g.vendorId === coupon.vendorId)!;
  await checkCouponUsage(prisma, coupon, { vendorSubtotal: group.subtotal, customerId: s.userId });
  const discountAmount = computeDiscount(coupon, group.subtotal);

  return ok({ vendorId: coupon.vendorId, vendorName: group.vendorName, discountAmount });
});
