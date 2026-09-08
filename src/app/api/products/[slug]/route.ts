export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";
import { activeFlashSalesByProduct } from "@/lib/pricing";

export const GET = handler(async (_req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const product = await prisma.product.findUnique({
    where: { slug: (await params).slug },
    include: {
      vendor: { select: { businessName: true, slug: true, city: true, region: true, ratingAvg: true, ratingCount: true, status: true } },
      category: { select: { name: true, slug: true } },
      brand: { select: { name: true, slug: true } },
      variants: true,
      reviews: {
        where: { status: "published" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, rating: true, title: true, body: true, vendorReply: true, vendorRepliedAt: true, createdAt: true, customer: { select: { name: true } } },
      },
    },
  });

  if (!product || product.status !== "active" || product.vendor.status !== "approved") {
    throw Errors.notFound("This product is not available.");
  }

  // Fire-and-forget view counter — never block the response on it.
  prisma.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const [flashSaleByProduct, related] = await Promise.all([
    activeFlashSalesByProduct(prisma, [product.id]),
    prisma.product.findMany({
      where: { id: { not: product.id }, categoryId: product.categoryId, status: "active", vendor: { status: "approved" } },
      orderBy: [{ ratingAvg: "desc" }, { viewCount: "desc" }],
      take: 8,
      select: {
        id: true, slug: true, name: true, price: true, discountPrice: true, images: true,
        ratingAvg: true, ratingCount: true, isFeatured: true, stock: true,
        vendor: { select: { businessName: true, slug: true } },
      },
    }),
  ]);

  return ok({ ...product, activeFlashSalePrice: flashSaleByProduct.get(product.id) ?? null, related });
});
