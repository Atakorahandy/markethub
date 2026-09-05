export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";
import { loadCartSummary } from "@/lib/cart";

export const GET = handler(async (req: Request) => {
  const s = await requireAuth(req);
  return ok(await loadCartSummary(s.userId));
});

const schema = z.object({
  productId: z.string().cuid(),
  variantId: z.string().cuid().nullable().optional(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

export const POST = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (!can(s, "cart.manage")) throw Errors.forbidden();
  const body = await parseBody(req, schema);

  const product = await prisma.product.findUnique({
    where: { id: body.productId },
    include: { vendor: { select: { status: true } } },
  });
  if (!product || product.status !== "active" || product.vendor.status !== "approved") {
    throw Errors.notFound("This product is not available.");
  }

  let stock = product.stock;
  if (body.variantId) {
    const variant = await prisma.productVariant.findUnique({ where: { id: body.variantId } });
    if (!variant || variant.productId !== product.id) throw Errors.validation({ variantId: "invalid" }, "Invalid product option.");
    stock = variant.stock;
  }
  if (stock <= 0) throw Errors.conflict("This item is out of stock.");

  // Prisma's compound-unique `where` input doesn't accept `null` for a
  // nullable field, so this looks up via findFirst instead of findUnique.
  const existing = await prisma.cartItem.findFirst({
    where: { userId: s.userId, productId: body.productId, variantId: body.variantId ?? null },
  });

  const desiredQty = Math.min((existing?.quantity ?? 0) + body.quantity, stock, 99);

  const item = existing
    ? await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: desiredQty } })
    : await prisma.cartItem.create({
        data: { userId: s.userId, productId: body.productId, variantId: body.variantId ?? null, quantity: desiredQty },
      });

  return ok(await loadCartSummary(s.userId), 201, { addedItemId: item.id });
});
