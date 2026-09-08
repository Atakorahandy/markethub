export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";

export const GET = handler(async (_req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  const vendor = await prisma.vendor.findUnique({
    where: { slug: (await params).slug },
    select: {
      id: true, slug: true, businessName: true, description: true, logoUrl: true, bannerUrl: true,
      city: true, region: true, ratingAvg: true, ratingCount: true, status: true, createdAt: true,
      _count: { select: { products: { where: { status: "active" } } } },
    },
  });
  if (!vendor || vendor.status !== "approved") throw Errors.notFound("This store is not available.");
  return ok(vendor);
});
