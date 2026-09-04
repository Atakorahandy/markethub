export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, ok, parseBody, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";

export const GET = handler(async (req: Request) => {
  const s = await requireAuth(req);
  const items = await prisma.wishlistItem.findMany({
    where: { userId: s.userId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true, slug: true, name: true, price: true, discountPrice: true, images: true, stock: true, status: true,
          vendor: { select: { businessName: true, slug: true, status: true } },
        },
      },
    },
  });
  return ok({ items });
});

const schema = z.object({ productId: z.string().cuid() });

export const POST = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (!can(s, "cart.manage")) throw Errors.forbidden();
  const body = await parseBody(req, schema);

  const product = await prisma.product.findUnique({ where: { id: body.productId } });
  if (!product) throw Errors.notFound();

  const item = await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId: s.userId, productId: body.productId } },
    create: { userId: s.userId, productId: body.productId },
    update: {},
  });
  return ok(item, 201);
});
