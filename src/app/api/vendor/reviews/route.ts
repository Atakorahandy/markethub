export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { handler, ok, Errors } from "@/lib/api";
import { requireAuth, can } from "@/lib/auth";

export const GET = handler(async (req: Request) => {
  const s = await requireAuth(req);
  if (!can(s, "reviews.manage") || s.vendorIds.length === 0) throw Errors.forbidden("A vendor account is required.");

  const items = await prisma.review.findMany({
    where: { vendorId: s.vendorIds[0] },
    orderBy: { createdAt: "desc" },
    include: { product: { select: { name: true, slug: true } }, customer: { select: { name: true } } },
  });
  return ok({ items });
});
