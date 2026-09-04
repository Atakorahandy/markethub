export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok } from "@/lib/api";

export const GET = handler(async () => {
  const now = new Date();
  const sales = await prisma.flashSale.findMany({
    where: { active: true, startsAt: { lte: now }, endsAt: { gte: now }, product: { status: "active", vendor: { status: "approved" } } },
    orderBy: { endsAt: "asc" },
    take: 24,
    include: {
      product: {
        select: {
          id: true, slug: true, name: true, price: true, discountPrice: true, images: true,
          ratingAvg: true, ratingCount: true, isFeatured: true, stock: true,
          vendor: { select: { businessName: true, slug: true } },
        },
      },
    },
  });

  const items = sales.map((s) => ({ ...s.product, flashSalePrice: s.salePrice, flashSaleEndsAt: s.endsAt }));
  return ok({ items });
});
