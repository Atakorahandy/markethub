export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";

export const GET = handler(async (_req: Request, { params }: { params: { slug: string } }) => {
  const product = await prisma.product.findUnique({
    where: { slug: params.slug },
    include: {
      vendor: { select: { businessName: true, slug: true, city: true, region: true, ratingAvg: true, ratingCount: true, status: true } },
      category: { select: { name: true, slug: true } },
      brand: { select: { name: true, slug: true } },
      variants: true,
    },
  });

  if (!product || product.status !== "active" || product.vendor.status !== "approved") {
    throw Errors.notFound("This product is not available.");
  }

  // Fire-and-forget view counter — never block the response on it.
  prisma.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  return ok(product);
});
