export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { recomputeProductRating, recomputeVendorRating } from "@/lib/reviews";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  orderItemId: z.string().cuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(100).optional(),
  body: z.string().trim().max(2000).optional(),
});

export const POST = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (!can(s, "reviews.create")) throw Errors.forbidden();
  rateLimit(`review:${s.userId}`, 20, 3600);
  const body = await parseBody(req, schema);

  const orderItem = await prisma.orderItem.findUnique({
    where: { id: body.orderItemId },
    include: { vendorOrder: { include: { order: true } }, review: true },
  });
  if (!orderItem || orderItem.vendorOrder.order.customerId !== s.userId) throw Errors.notFound();
  if (orderItem.vendorOrder.status !== "delivered") throw Errors.conflict("You can review an item once it's been delivered.");
  if (orderItem.review) throw Errors.conflict("You've already reviewed this item.");

  const review = await prisma.$transaction(async (tx) => {
    const r = await tx.review.create({
      data: {
        productId: orderItem.productId,
        vendorId: orderItem.vendorOrder.vendorId,
        customerId: s.userId,
        orderItemId: orderItem.id,
        rating: body.rating,
        title: body.title ?? "",
        body: body.body ?? "",
      },
    });
    await recomputeProductRating(tx, orderItem.productId);
    await recomputeVendorRating(tx, orderItem.vendorOrder.vendorId);
    return r;
  });

  await audit({ req, actorId: s.userId, actorName: s.name, action: "review.created", entityType: "review", entityId: review.id, meta: { productId: orderItem.productId, rating: body.rating } });
  return ok(review, 201);
});
